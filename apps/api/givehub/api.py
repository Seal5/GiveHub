import csv
import io
import re
import uuid
from datetime import UTC, datetime
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import quote

import httpx
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from givehub.auth import Identity, current_identity
from givehub.config import Settings, get_settings
from givehub.database import get_db
from givehub.email import send_email
from givehub.formatting import as_utc as _as_utc
from givehub.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusHistory,
    Attendance,
    AttendanceStatus,
    Cause,
    Opportunity,
    OpportunityEvent,
    OpportunityEventType,
    OpportunityStatus,
    Organisation,
    Profile,
    Recurrence,
    Role,
    SavedOpportunity,
    Suburb,
    VerificationStatus,
    WaiverAcceptance,
    WaiverDocument,
)
from givehub.notifications import (
    Message,
    application_received_for_organiser,
    application_received_for_volunteer,
    application_status_changed,
    guardian_consent_copy,
)
from givehub.schemas import (
    AnalyticsOut,
    ApplicationCreate,
    ApplicationOut,
    ApplicationTransition,
    AttendanceRowOut,
    AttendanceSheetOut,
    AttendanceUpdate,
    CauseOut,
    ImpactCauseOut,
    ImpactEventOut,
    ImpactOut,
    LocationResult,
    LocationSuggestion,
    OpportunityCreate,
    OpportunityEventCreate,
    OpportunityOut,
    OpportunityUpdate,
    PipelineOut,
    ProfileCreate,
    ProfileOut,
    ProfileUpdate,
    SuburbOut,
    UploadOut,
    UploadRequest,
    WaiverOut,
    WaiverUpdate,
)
from givehub.services import (
    active_waiver,
    application_options,
    change_application_status,
    opportunity_query,
    require_causes,
    require_owned_opportunity,
    require_profile,
    saved_opportunity_ids,
    to_application_out,
    to_opportunity_out,
)

router = APIRouter(prefix="/v1")


def queue_message(
    background_tasks: BackgroundTasks,
    settings: Settings,
    *,
    recipient: str,
    message: Message,
) -> None:
    """Sends after the response so a slow provider never delays the volunteer."""
    background_tasks.add_task(
        send_email,
        settings,
        recipient=recipient,
        subject=message.subject,
        text=message.text,
        html=message.html,
        attachments=message.attachments,
        reply_to=message.reply_to,
    )


def analytics_out(
    db: Session, *, organisation_id: uuid.UUID, opportunity_id: uuid.UUID | None = None
) -> AnalyticsOut:
    statement = (
        select(OpportunityEvent.event_type, func.count(OpportunityEvent.id))
        .join(Opportunity)
        .where(Opportunity.organisation_id == organisation_id)
        .group_by(OpportunityEvent.event_type)
    )
    if opportunity_id:
        statement = statement.where(OpportunityEvent.opportunity_id == opportunity_id)
    counts: dict[OpportunityEventType, int] = {}
    for event_type, count in db.execute(statement):
        counts[event_type] = count
    views = counts.get(OpportunityEventType.viewed, 0)
    submitted = counts.get(OpportunityEventType.application_submitted, 0)
    return AnalyticsOut(
        views=views,
        application_starts=counts.get(OpportunityEventType.application_started, 0),
        applications_submitted=submitted,
        shares=counts.get(OpportunityEventType.shared, 0),
        view_to_application_rate=round((submitted / views * 100) if views else 0, 1),
    )


def filtered_applications(
    db: Session,
    *,
    opportunity_id: uuid.UUID,
    stage: ApplicationStatus | None = None,
    q: str | None = None,
    availability: str | None = None,
) -> list[Application]:
    statement = (
        select(Application)
        .options(*application_options())
        .join(Application.volunteer)
        .where(Application.opportunity_id == opportunity_id)
        .order_by(Application.created_at)
    )
    if stage:
        statement = statement.where(Application.status == stage)
    if q:
        term = f"%{q.strip()}%"
        statement = statement.where(
            or_(
                Profile.display_name.ilike(term),
                Profile.email.ilike(term),
                Application.experience.ilike(term),
                Application.note.ilike(term),
                Application.availability.ilike(term),
            )
        )
    if availability:
        statement = statement.where(Application.availability.ilike(f"%{availability.strip()}%"))
    return list(db.scalars(statement).all())


def spreadsheet_safe(value: str) -> str:
    """Prevent applicant-provided text from becoming a spreadsheet formula."""
    return f"'{value}" if value.startswith(("=", "+", "-", "@")) else value


def profile_out(profile: Profile) -> ProfileOut:
    return ProfileOut(
        id=profile.id,
        role=profile.role,
        display_name=profile.display_name,
        email=profile.email,
        search_location_label=profile.search_location_label,
        search_latitude=profile.search_latitude,
        search_longitude=profile.search_longitude,
        search_radius_km=profile.search_radius_km,
        theme=profile.theme,
        organisation_name=profile.organisation.name if profile.organisation else None,
    )


@router.get("/reference/suburbs", response_model=list[SuburbOut])
def list_suburbs(db: Session = Depends(get_db)) -> list[Suburb]:
    return list(db.scalars(select(Suburb).order_by(Suburb.name)).all())


@router.get("/reference/causes", response_model=list[CauseOut])
def list_causes(db: Session = Depends(get_db)) -> list[Cause]:
    return list(db.scalars(select(Cause).order_by(Cause.name)).all())


@router.get("/locations/autocomplete", response_model=list[LocationSuggestion])
def autocomplete_location(
    q: str = Query(min_length=3, max_length=120),
    _identity: Identity = Depends(current_identity),
    settings: Settings = Depends(get_settings),
) -> list[LocationSuggestion]:
    if not settings.google_places_api_key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Location search is not configured"
        )
    try:
        response = httpx.post(
            "https://places.googleapis.com/v1/places:autocomplete",
            headers={
                "X-Goog-Api-Key": settings.google_places_api_key,
                "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
            },
            json={"input": q, "includedRegionCodes": ["nz"]},
            timeout=8,
        )
        response.raise_for_status()
        suggestions = response.json().get("suggestions", [])
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Location search is unavailable") from exc
    return [
        LocationSuggestion(
            place_id=prediction["placeId"],
            label=prediction["text"]["text"],
        )
        for suggestion in suggestions[:6]
        if (prediction := suggestion.get("placePrediction"))
        and prediction.get("placeId")
        and prediction.get("text", {}).get("text")
    ]


def address_component(payload: dict[str, Any], *component_types: str) -> str:
    for component in payload.get("addressComponents", []):
        if any(component_type in component.get("types", []) for component_type in component_types):
            return str(component.get("longText", ""))
    return ""


@router.get("/locations/places/{place_id}", response_model=LocationResult)
def resolve_location(
    place_id: str,
    _identity: Identity = Depends(current_identity),
    settings: Settings = Depends(get_settings),
) -> LocationResult:
    if not settings.google_places_api_key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Location search is not configured"
        )
    try:
        response = httpx.get(
            f"https://places.googleapis.com/v1/places/{quote(place_id, safe='')}",
            headers={
                "X-Goog-Api-Key": settings.google_places_api_key,
                "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
            },
            timeout=8,
        )
        response.raise_for_status()
        payload = response.json()
        coordinates = payload["location"]
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Location details are unavailable"
        ) from exc
    street = " ".join(
        part
        for part in (
            address_component(payload, "street_number"),
            address_component(payload, "route"),
        )
        if part
    )
    locality = address_component(payload, "sublocality_level_1", "locality")
    city = address_component(payload, "locality", "postal_town", "administrative_area_level_2")
    return LocationResult(
        place_id=str(payload.get("id", place_id)),
        label=str(payload.get("formattedAddress", street or locality or city)),
        address_line=street or str(payload.get("formattedAddress", "")),
        locality=locality,
        city=city,
        postcode=address_component(payload, "postal_code") or None,
        country_code=(address_component(payload, "country") and "NZ") or "NZ",
        latitude=float(coordinates["latitude"]),
        longitude=float(coordinates["longitude"]),
    )


@router.post("/profiles", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
def create_profile(
    payload: ProfileCreate,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> ProfileOut:
    if db.get(Profile, identity.user_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Profile already exists")
    if identity.email and identity.email.casefold() != payload.email.casefold():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Email does not match the signed-in account")
    profile = Profile(
        id=identity.user_id,
        role=payload.role,
        display_name=payload.display_name,
        email=str(payload.email),
    )
    db.add(profile)
    if payload.role == Role.organiser:
        db.add(
            Organisation(
                owner=profile,
                name=payload.organisation_name or payload.display_name,
                verification_status=VerificationStatus.approved,
            )
        )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "That email is already registered") from exc
    db.refresh(profile)
    return profile_out(profile)


@router.get("/profiles/me", response_model=ProfileOut)
def get_me(
    identity: Identity = Depends(current_identity), db: Session = Depends(get_db)
) -> ProfileOut:
    return profile_out(require_profile(db, identity.user_id))


@router.put("/profiles/me/preferences", response_model=ProfileOut)
def update_preferences(
    payload: ProfileUpdate,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> ProfileOut:
    profile = require_profile(db, identity.user_id)
    profile.search_location_label = payload.search_location_label
    profile.search_latitude = payload.search_latitude
    profile.search_longitude = payload.search_longitude
    profile.search_radius_km = payload.search_radius_km
    profile.theme = payload.theme
    db.commit()
    db.refresh(profile)
    return profile_out(profile)


@router.get("/opportunities", response_model=list[OpportunityOut])
def list_opportunities(
    q: str | None = Query(default=None, max_length=100),
    cause: str | None = None,
    recurrence: Recurrence | None = None,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    radius_km: int | None = Query(default=None, ge=1, le=100),
    starts_after: datetime | None = None,
    saved: bool = False,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> list[OpportunityOut]:
    viewer = require_profile(db, identity.user_id)
    if (lat is None) != (lng is None):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Latitude and longitude are required together"
        )
    origin = (
        (lat, lng)
        if lat is not None and lng is not None
        else (
            (viewer.search_latitude, viewer.search_longitude)
            if viewer.search_latitude is not None and viewer.search_longitude is not None
            else None
        )
    )
    effective_radius = radius_km or viewer.search_radius_km
    statement = opportunity_query().where(Opportunity.status == OpportunityStatus.published)
    if q:
        term = f"%{q.strip()}%"
        statement = statement.join(Opportunity.organisation).where(
            or_(
                Opportunity.title.ilike(term),
                Opportunity.description.ilike(term),
                Opportunity.tasks.ilike(term),
                Opportunity.location_label.ilike(term),
                Opportunity.locality.ilike(term),
                Opportunity.city.ilike(term),
                Organisation.name.ilike(term),
            )
        )
    if cause:
        statement = statement.join(Opportunity.causes).where(Cause.slug == cause)
    if recurrence:
        statement = statement.where(Opportunity.recurrence == recurrence)
    if starts_after:
        statement = statement.where(Opportunity.starts_at >= starts_after)
    saved_ids = saved_opportunity_ids(db, viewer.id)
    if saved:
        statement = statement.where(Opportunity.id.in_(saved_ids))
    if origin and db.bind and db.bind.dialect.name == "postgresql":
        statement = statement.where(
            text(
                "ST_DWithin("
                "ST_SetSRID(ST_MakePoint(opportunities.longitude, opportunities.latitude), 4326)::geography, "
                "ST_SetSRID(ST_MakePoint(:origin_lng, :origin_lat), 4326)::geography, :radius_m)"
            )
        ).params(origin_lat=origin[0], origin_lng=origin[1], radius_m=effective_radius * 1000)
    items = list(db.scalars(statement.order_by(Opportunity.starts_at)).unique().all())
    outputs = [to_opportunity_out(db, item, origin, saved_ids) for item in items]
    if origin:
        outputs = [item for item in outputs if (item.distance_km or 0) <= effective_radius]
        outputs.sort(key=lambda item: (item.distance_km or 0, item.starts_at))
    return outputs


@router.get("/opportunities/{opportunity_id}", response_model=OpportunityOut)
def get_opportunity(
    opportunity_id: uuid.UUID,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> OpportunityOut:
    viewer = require_profile(db, identity.user_id)
    item = db.scalar(opportunity_query().where(Opportunity.id == opportunity_id))
    if item is None or (
        item.status != OpportunityStatus.published
        and (not viewer.organisation or item.organisation_id != viewer.organisation.id)
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Opportunity not found")
    origin = (
        (viewer.search_latitude, viewer.search_longitude)
        if viewer.search_latitude is not None and viewer.search_longitude is not None
        else None
    )
    return to_opportunity_out(db, item, origin, saved_opportunity_ids(db, viewer.id))


@router.post(
    "/opportunities/{opportunity_id}/events",
    status_code=status.HTTP_204_NO_CONTENT,
)
def record_opportunity_event(
    opportunity_id: uuid.UUID,
    payload: OpportunityEventCreate,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> None:
    profile = require_profile(db, identity.user_id, Role.volunteer)
    item = db.get(Opportunity, opportunity_id)
    if not item or item.status != OpportunityStatus.published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Opportunity not found")
    if payload.event_type == OpportunityEventType.application_submitted:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Application submissions are recorded by GiveHub",
        )
    db.add(
        OpportunityEvent(
            opportunity_id=opportunity_id,
            profile_id=profile.id,
            event_type=payload.event_type,
        )
    )
    db.commit()


@router.put("/opportunities/{opportunity_id}/saved", status_code=status.HTTP_204_NO_CONTENT)
def save_opportunity(
    opportunity_id: uuid.UUID,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> None:
    profile = require_profile(db, identity.user_id, Role.volunteer)
    item = db.get(Opportunity, opportunity_id)
    if not item or item.status != OpportunityStatus.published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Opportunity not found")
    existing = db.scalar(
        select(SavedOpportunity).where(
            SavedOpportunity.profile_id == profile.id,
            SavedOpportunity.opportunity_id == opportunity_id,
        )
    )
    if not existing:
        db.add(SavedOpportunity(profile_id=profile.id, opportunity_id=opportunity_id))
        db.commit()


@router.delete("/opportunities/{opportunity_id}/saved", status_code=status.HTTP_204_NO_CONTENT)
def unsave_opportunity(
    opportunity_id: uuid.UUID,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> None:
    profile = require_profile(db, identity.user_id, Role.volunteer)
    existing = db.scalar(
        select(SavedOpportunity).where(
            SavedOpportunity.profile_id == profile.id,
            SavedOpportunity.opportunity_id == opportunity_id,
        )
    )
    if existing:
        db.delete(existing)
        db.commit()


@router.get("/opportunities/{opportunity_id}/waiver", response_model=WaiverOut | None)
def get_opportunity_waiver(
    opportunity_id: uuid.UUID,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> WaiverDocument | None:
    """Returns the waiver a volunteer must sign, or null when none is required."""
    require_profile(db, identity.user_id)
    item = db.scalar(opportunity_query().where(Opportunity.id == opportunity_id))
    if not item or item.status != OpportunityStatus.published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Opportunity not found")
    if not item.requires_waiver:
        return None
    waiver = active_waiver(db, item.organisation_id)
    if waiver is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "This opportunity requires a waiver, but none is published yet",
        )
    return waiver


@router.post(
    "/opportunities/{opportunity_id}/applications",
    response_model=ApplicationOut,
    status_code=status.HTTP_201_CREATED,
)
def apply(
    opportunity_id: uuid.UUID,
    payload: ApplicationCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    identity: Identity = Depends(current_identity),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> ApplicationOut:
    volunteer = require_profile(db, identity.user_id, Role.volunteer)
    item = db.get(Opportunity, opportunity_id)
    if not item or item.status != OpportunityStatus.published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Opportunity not found")
    waiver: WaiverDocument | None = None
    if item.requires_waiver:
        if payload.waiver is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "This opportunity requires a signed waiver",
            )
        waiver = db.get(WaiverDocument, payload.waiver.waiver_document_id)
        expected = active_waiver(db, item.organisation_id)
        # Reject a stale copy so the wording signed is always the wording shown.
        if waiver is None or expected is None or waiver.id != expected.id:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "The waiver was updated; reopen the application to review it",
            )
    application = Application(
        id=uuid.uuid4(),
        opportunity_id=opportunity_id,
        volunteer_id=volunteer.id,
        note=payload.note,
        experience=payload.experience,
        availability=payload.availability,
    )
    db.add(application)
    if waiver is not None and payload.waiver is not None:
        db.add(
            WaiverAcceptance(
                application_id=application.id,
                waiver_document_id=waiver.id,
                signed_name=payload.waiver.signed_name.strip(),
                is_minor=payload.waiver.is_minor,
                guardian_name=payload.waiver.guardian_name,
                guardian_email=str(payload.waiver.guardian_email) if payload.waiver.guardian_email else None,
                guardian_relationship=payload.waiver.guardian_relationship,
                signed_ip=request.client.host if request.client else None,
            )
        )
    db.add(
        ApplicationStatusHistory(
            application_id=application.id,
            from_status=None,
            to_status=ApplicationStatus.received,
            changed_by=volunteer.id,
        )
    )
    db.add(
        OpportunityEvent(
            opportunity_id=opportunity_id,
            profile_id=volunteer.id,
            event_type=OpportunityEventType.application_submitted,
        )
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already applied") from exc
    loaded = db.scalar(
        select(Application).options(*application_options()).where(Application.id == application.id)
    )
    assert loaded
    queue_message(
        background_tasks,
        settings,
        recipient=loaded.opportunity.organisation.owner.email,
        message=application_received_for_organiser(loaded),
    )
    queue_message(
        background_tasks,
        settings,
        recipient=loaded.volunteer.email,
        message=application_received_for_volunteer(loaded),
    )
    acceptance = loaded.waiver_acceptance
    if acceptance and acceptance.is_minor and acceptance.guardian_email:
        queue_message(
            background_tasks,
            settings,
            recipient=acceptance.guardian_email,
            message=guardian_consent_copy(
                loaded, acceptance.waiver_document.title, acceptance.waiver_document.version
            ),
        )
    return to_application_out(loaded)


@router.get("/applications/me", response_model=list[ApplicationOut])
def my_applications(
    identity: Identity = Depends(current_identity), db: Session = Depends(get_db)
) -> list[ApplicationOut]:
    volunteer = require_profile(db, identity.user_id, Role.volunteer)
    items = db.scalars(
        select(Application)
        .options(*application_options())
        .where(Application.volunteer_id == volunteer.id)
        .order_by(Application.created_at.desc())
    ).all()
    return [to_application_out(item) for item in items]


@router.post("/applications/{application_id}/withdraw", response_model=ApplicationOut)
def withdraw_application(
    application_id: uuid.UUID,
    payload: ApplicationTransition,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> ApplicationOut:
    volunteer = require_profile(db, identity.user_id, Role.volunteer)
    item = db.scalar(
        select(Application).options(*application_options()).where(Application.id == application_id)
    )
    if not item or item.volunteer_id != volunteer.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    if payload.status != ApplicationStatus.withdrawn:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Only withdrawal is allowed")
    change_application_status(db, item, payload.status, volunteer.id, payload.version)
    db.commit()
    db.refresh(item)
    return to_application_out(item)


@router.get("/organiser/opportunities", response_model=list[OpportunityOut])
def organiser_opportunities(
    identity: Identity = Depends(current_identity), db: Session = Depends(get_db)
) -> list[OpportunityOut]:
    organiser = require_profile(db, identity.user_id, Role.organiser)
    assert organiser.organisation
    items = (
        db.scalars(
            opportunity_query()
            .where(Opportunity.organisation_id == organiser.organisation.id)
            .order_by(Opportunity.starts_at)
        )
        .unique()
        .all()
    )
    return [to_opportunity_out(db, item) for item in items]


@router.get("/organiser/analytics", response_model=AnalyticsOut)
def organiser_analytics(
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> AnalyticsOut:
    organiser = require_profile(db, identity.user_id, Role.organiser)
    assert organiser.organisation
    return analytics_out(db, organisation_id=organiser.organisation.id)


@router.get("/organiser/waiver", response_model=WaiverOut)
def get_organiser_waiver(
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> WaiverDocument:
    organiser = require_profile(db, identity.user_id, Role.organiser)
    assert organiser.organisation
    waiver = active_waiver(db, organiser.organisation.id)
    if waiver is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No waiver is published")
    return waiver


@router.put("/organiser/waiver", response_model=WaiverOut)
def update_organiser_waiver(
    payload: WaiverUpdate,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> WaiverDocument:
    """Publishes a new waiver version. Existing acceptances keep pointing at the
    wording they were signed against, so past agreements stay auditable."""
    organiser = require_profile(db, identity.user_id, Role.organiser)
    assert organiser.organisation
    current = db.scalar(
        select(WaiverDocument)
        .where(
            WaiverDocument.organisation_id == organiser.organisation.id,
            WaiverDocument.is_active.is_(True),
        )
        .order_by(WaiverDocument.version.desc())
    )
    if current:
        current.is_active = False
    published = WaiverDocument(
        organisation_id=organiser.organisation.id,
        title=payload.title,
        body=payload.body,
        version=(current.version + 1) if current else 1,
        is_active=True,
    )
    db.add(published)
    db.commit()
    db.refresh(published)
    return published


@router.post(
    "/organiser/opportunities", response_model=OpportunityOut, status_code=status.HTTP_201_CREATED
)
def create_opportunity(
    payload: OpportunityCreate,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> OpportunityOut:
    organiser = require_profile(db, identity.user_id, Role.organiser)
    assert organiser.organisation
    causes = require_causes(db, payload.cause_ids)
    item = Opportunity(
        organisation_id=organiser.organisation.id,
        causes=causes,
        **payload.model_dump(exclude={"cause_ids"}),
    )
    db.add(item)
    db.commit()
    loaded = db.scalar(opportunity_query().where(Opportunity.id == item.id))
    assert loaded
    return to_opportunity_out(db, loaded)


@router.patch("/organiser/opportunities/{opportunity_id}", response_model=OpportunityOut)
def update_opportunity(
    opportunity_id: uuid.UUID,
    payload: OpportunityUpdate,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> OpportunityOut:
    organiser = require_profile(db, identity.user_id, Role.organiser)
    item = require_owned_opportunity(db, opportunity_id, organiser.id)
    if item.version != payload.version:
        raise HTTPException(status.HTTP_409_CONFLICT, "Opportunity changed; refresh and try again")
    updates = payload.model_dump(exclude_unset=True, exclude={"version", "cause_ids"})
    for key, value in updates.items():
        setattr(item, key, value)
    if payload.cause_ids is not None:
        item.causes = require_causes(db, payload.cause_ids)
    if item.ends_at <= item.starts_at:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "End time must follow start time")
    item.version += 1
    db.commit()
    return to_opportunity_out(db, item)


@router.post("/organiser/opportunities/{opportunity_id}/publish", response_model=OpportunityOut)
def publish_opportunity(
    opportunity_id: uuid.UUID,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> OpportunityOut:
    organiser = require_profile(db, identity.user_id, Role.organiser)
    item = require_owned_opportunity(db, opportunity_id, organiser.id)
    assert organiser.organisation
    if organiser.organisation.verification_status != VerificationStatus.approved:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Organisation verification is required")
    item.status = OpportunityStatus.published
    item.version += 1
    db.commit()
    return to_opportunity_out(db, item)


@router.post("/organiser/opportunities/{opportunity_id}/unpublish", response_model=OpportunityOut)
def unpublish_opportunity(
    opportunity_id: uuid.UUID,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> OpportunityOut:
    organiser = require_profile(db, identity.user_id, Role.organiser)
    item = require_owned_opportunity(db, opportunity_id, organiser.id)
    item.status = OpportunityStatus.unpublished
    item.version += 1
    db.commit()
    return to_opportunity_out(db, item)


@router.get("/organiser/opportunities/{opportunity_id}/pipeline", response_model=PipelineOut)
def application_pipeline(
    opportunity_id: uuid.UUID,
    stage: ApplicationStatus | None = None,
    q: str | None = Query(default=None, max_length=120),
    availability: str | None = Query(default=None, max_length=120),
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> PipelineOut:
    organiser = require_profile(db, identity.user_id, Role.organiser)
    require_owned_opportunity(db, opportunity_id, organiser.id)
    all_items = filtered_applications(db, opportunity_id=opportunity_id)
    counts = {status: 0 for status in ApplicationStatus}
    for item in all_items:
        counts[item.status] += 1
    items = filtered_applications(
        db,
        opportunity_id=opportunity_id,
        stage=stage,
        q=q,
        availability=availability,
    )
    return PipelineOut(counts=counts, applications=[to_application_out(item) for item in items])


@router.get("/organiser/opportunities/{opportunity_id}/analytics", response_model=AnalyticsOut)
def opportunity_analytics(
    opportunity_id: uuid.UUID,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> AnalyticsOut:
    organiser = require_profile(db, identity.user_id, Role.organiser)
    item = require_owned_opportunity(db, opportunity_id, organiser.id)
    return analytics_out(
        db,
        organisation_id=item.organisation_id,
        opportunity_id=opportunity_id,
    )


def event_hours(item: Opportunity) -> float:
    """Event length in hours, used as the default when marking someone attended."""
    return round(max((item.ends_at - item.starts_at).total_seconds() / 3600, 0), 2)


@router.get(
    "/organiser/opportunities/{opportunity_id}/attendance", response_model=AttendanceSheetOut
)
def attendance_sheet(
    opportunity_id: uuid.UUID,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> AttendanceSheetOut:
    organiser = require_profile(db, identity.user_id, Role.organiser)
    item = require_owned_opportunity(db, opportunity_id, organiser.id)
    confirmed = db.scalars(
        select(Application)
        .options(*application_options())
        .join(Application.volunteer)
        .where(
            Application.opportunity_id == opportunity_id,
            Application.status == ApplicationStatus.confirmed,
        )
        .order_by(Profile.display_name)
    ).all()
    rows = [
        AttendanceRowOut(
            application_id=application.id,
            volunteer_name=application.volunteer.display_name,
            volunteer_email=application.volunteer.email,
            status=application.attendance.status if application.attendance else AttendanceStatus.expected,
            hours=application.attendance.hours if application.attendance else 0.0,
            notes=application.attendance.notes if application.attendance else "",
        )
        for application in confirmed
    ]
    return AttendanceSheetOut(
        opportunity_id=item.id,
        opportunity_title=item.title,
        default_hours=event_hours(item),
        expected=sum(1 for row in rows if row.status == AttendanceStatus.expected),
        attended=sum(1 for row in rows if row.status == AttendanceStatus.attended),
        no_show=sum(1 for row in rows if row.status == AttendanceStatus.no_show),
        total_hours=round(sum(row.hours for row in rows), 2),
        rows=rows,
    )


@router.put("/organiser/applications/{application_id}/attendance", response_model=AttendanceRowOut)
def record_attendance(
    application_id: uuid.UUID,
    payload: AttendanceUpdate,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> AttendanceRowOut:
    organiser = require_profile(db, identity.user_id, Role.organiser)
    application = db.scalar(
        select(Application).options(*application_options()).where(Application.id == application_id)
    )
    if not application or application.opportunity.organisation.owner_id != organiser.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    if application.status != ApplicationStatus.confirmed:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only confirmed volunteers can be marked off"
        )
    hours = payload.hours
    if hours is None:
        hours = event_hours(application.opportunity) if payload.status == AttendanceStatus.attended else 0.0
    if payload.status != AttendanceStatus.attended:
        # Hours only mean something for someone who actually turned up.
        hours = 0.0
    record = application.attendance
    if record is None:
        record = Attendance(application_id=application.id)
        db.add(record)
    record.status = payload.status
    record.hours = hours
    record.notes = payload.notes
    record.recorded_by = organiser.id
    record.recorded_at = datetime.now(UTC)
    db.commit()
    return AttendanceRowOut(
        application_id=application.id,
        volunteer_name=application.volunteer.display_name,
        volunteer_email=application.volunteer.email,
        status=record.status,
        hours=record.hours,
        notes=record.notes,
    )


@router.get("/volunteers/me/impact", response_model=ImpactOut)
def my_impact(
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> ImpactOut:
    volunteer = require_profile(db, identity.user_id, Role.volunteer)
    attended = list(
        db.scalars(
            select(Application)
            .options(
                *application_options(),
                selectinload(Application.opportunity).selectinload(Opportunity.causes),
            )
            .join(Application.attendance)
            .join(Application.opportunity)
            .where(
                Application.volunteer_id == volunteer.id,
                Attendance.status == AttendanceStatus.attended,
            )
            .order_by(Opportunity.starts_at.desc())
        ).all()
    )
    now = datetime.now(UTC)
    upcoming = (
        db.scalar(
            select(func.count(Application.id))
            .join(Application.opportunity)
            .where(
                Application.volunteer_id == volunteer.id,
                Application.status == ApplicationStatus.confirmed,
                Opportunity.starts_at >= now,
            )
        )
        or 0
    )
    cause_events: dict[str, tuple[str, int]] = {}
    for application in attended:
        for cause in application.opportunity.causes:
            name, count = cause_events.get(cause.slug, (cause.name, 0))
            cause_events[cause.slug] = (name, count + 1)
    total_hours = round(sum(a.attendance.hours for a in attended if a.attendance), 2)
    hours_this_year = round(
        sum(
            a.attendance.hours
            for a in attended
            if a.attendance and _as_utc(a.opportunity.starts_at).year == now.year
        ),
        2,
    )
    return ImpactOut(
        total_hours=total_hours,
        events_attended=len(attended),
        organisations_supported=len({a.opportunity.organisation_id for a in attended}),
        upcoming_confirmed=int(upcoming),
        hours_this_year=hours_this_year,
        causes=[
            ImpactCauseOut(slug=slug, name=name, events=count)
            for slug, (name, count) in sorted(
                cause_events.items(), key=lambda entry: entry[1][1], reverse=True
            )
        ],
        recent=[
            ImpactEventOut(
                opportunity_id=a.opportunity_id,
                title=a.opportunity.title,
                organisation_name=a.opportunity.organisation.name,
                starts_at=a.opportunity.starts_at,
                hours=a.attendance.hours if a.attendance else 0.0,
            )
            for a in attended[:10]
        ],
    )


@router.get("/organiser/opportunities/{opportunity_id}/applications.csv")
def export_applications(
    opportunity_id: uuid.UUID,
    stage: ApplicationStatus | None = None,
    q: str | None = Query(default=None, max_length=120),
    availability: str | None = Query(default=None, max_length=120),
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> Response:
    organiser = require_profile(db, identity.user_id, Role.organiser)
    item = require_owned_opportunity(db, opportunity_id, organiser.id)
    applications = filtered_applications(
        db,
        opportunity_id=opportunity_id,
        stage=stage,
        q=q,
        availability=availability,
    )
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(
        [
            "Name",
            "Email",
            "Status",
            "Availability",
            "Experience",
            "Application note",
            "Applied at",
            "Waiver signed at",
            "Waiver version",
            "Waiver signed by",
            "Under 18",
            "Guardian name",
            "Guardian email",
        ]
    )
    for application in applications:
        waiver = application.waiver_acceptance
        writer.writerow(
            [
                application.volunteer.display_name,
                application.volunteer.email,
                application.status.value,
                spreadsheet_safe(application.availability),
                spreadsheet_safe(application.experience),
                spreadsheet_safe(application.note),
                application.created_at.isoformat(),
                waiver.accepted_at.isoformat() if waiver else "",
                waiver.waiver_document.version if waiver else "",
                spreadsheet_safe(waiver.signed_name) if waiver else "",
                ("yes" if waiver.is_minor else "no") if waiver else "",
                spreadsheet_safe(waiver.guardian_name or "") if waiver else "",
                waiver.guardian_email or "" if waiver else "",
            ]
        )
    slug = re.sub(r"[^a-z0-9]+", "-", item.title.lower()).strip("-") or "opportunity"
    filename = f"{slug}-applicants.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"content-disposition": f'attachment; filename="{filename}"'},
    )


@router.patch("/organiser/applications/{application_id}", response_model=ApplicationOut)
def transition_application(
    application_id: uuid.UUID,
    payload: ApplicationTransition,
    background_tasks: BackgroundTasks,
    identity: Identity = Depends(current_identity),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> ApplicationOut:
    organiser = require_profile(db, identity.user_id, Role.organiser)
    item = db.scalar(
        select(Application).options(*application_options()).where(Application.id == application_id)
    )
    if not item or item.opportunity.organisation.owner_id != organiser.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    if payload.status == ApplicationStatus.withdrawn:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Only volunteers can withdraw")
    change_application_status(db, item, payload.status, organiser.id, payload.version)
    db.commit()
    db.refresh(item)
    queue_message(
        background_tasks,
        settings,
        recipient=item.volunteer.email,
        message=application_status_changed(item),
    )
    return to_application_out(item)


@router.post("/organiser/opportunities/{opportunity_id}/image-upload", response_model=UploadOut)
def create_image_upload(
    opportunity_id: uuid.UUID,
    payload: UploadRequest,
    identity: Identity = Depends(current_identity),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> UploadOut:
    organiser = require_profile(db, identity.user_id, Role.organiser)
    require_owned_opportunity(db, opportunity_id, organiser.id)
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Storage is not configured")
    extension = PurePosixPath(payload.filename).suffix.lower()
    expected = {"image/jpeg": {".jpg", ".jpeg"}, "image/png": {".png"}, "image/webp": {".webp"}}
    if extension not in expected[payload.content_type]:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "File extension does not match type"
        )
    path = f"{organiser.id}/{opportunity_id}/{uuid.uuid4()}{extension}"
    object_path = quote(f"{settings.supabase_storage_bucket}/{path}", safe="/")
    headers = {
        "authorization": f"Bearer {settings.supabase_secret_key}",
        "apikey": settings.supabase_secret_key,
        "content-type": "application/json",
    }
    try:
        response = httpx.post(
            f"{settings.supabase_url}/storage/v1/object/upload/sign/{object_path}",
            headers=headers,
            json={"upsert": False},
            timeout=10,
        )
        response.raise_for_status()
        signed = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Storage could not create an upload"
        ) from exc
    public = f"{settings.supabase_url}/storage/v1/object/public/{object_path}"
    return UploadOut(path=path, token=signed["token"], public_url=public)
