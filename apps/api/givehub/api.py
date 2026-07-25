import uuid
from datetime import datetime
from pathlib import PurePosixPath
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from givehub.auth import Identity, current_identity
from givehub.config import Settings, get_settings
from givehub.database import get_db
from givehub.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusHistory,
    Cause,
    Opportunity,
    OpportunityStatus,
    Organisation,
    Profile,
    Recurrence,
    Role,
    SavedOpportunity,
    Suburb,
    VerificationStatus,
)
from givehub.schemas import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationTransition,
    CauseOut,
    OpportunityCreate,
    OpportunityOut,
    OpportunityUpdate,
    PipelineOut,
    ProfileCreate,
    ProfileOut,
    ProfileUpdate,
    SuburbOut,
    UploadOut,
    UploadRequest,
)
from givehub.services import (
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


def profile_out(profile: Profile) -> ProfileOut:
    return ProfileOut(
        id=profile.id,
        role=profile.role,
        display_name=profile.display_name,
        email=profile.email,
        suburb=SuburbOut.model_validate(profile.suburb) if profile.suburb else None,
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
    if payload.suburb_id and not db.get(Suburb, payload.suburb_id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown suburb")
    profile.suburb_id = payload.suburb_id
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
    suburb_id: uuid.UUID | None = None,
    radius_km: int | None = Query(default=None, ge=1, le=100),
    starts_after: datetime | None = None,
    saved: bool = False,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> list[OpportunityOut]:
    viewer = require_profile(db, identity.user_id)
    statement = opportunity_query().where(Opportunity.status == OpportunityStatus.published)
    if q:
        term = f"%{q.strip()}%"
        statement = statement.join(Opportunity.organisation).where(
            or_(
                Opportunity.title.ilike(term),
                Opportunity.description.ilike(term),
                Opportunity.tasks.ilike(term),
                Organisation.name.ilike(term),
            )
        )
    if cause:
        statement = statement.join(Opportunity.causes).where(Cause.slug == cause)
    if recurrence:
        statement = statement.where(Opportunity.recurrence == recurrence)
    if suburb_id:
        statement = statement.where(Opportunity.suburb_id == suburb_id)
    if starts_after:
        statement = statement.where(Opportunity.starts_at >= starts_after)
    saved_ids = saved_opportunity_ids(db, viewer.id)
    if saved:
        statement = statement.where(Opportunity.id.in_(saved_ids))
    items = list(db.scalars(statement.order_by(Opportunity.starts_at)).unique().all())
    outputs = [to_opportunity_out(db, item, viewer, saved_ids) for item in items]
    effective_radius = radius_km or viewer.search_radius_km
    if viewer.suburb and not suburb_id:
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
    return to_opportunity_out(db, item, viewer, saved_opportunity_ids(db, viewer.id))


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


@router.post(
    "/opportunities/{opportunity_id}/applications",
    response_model=ApplicationOut,
    status_code=status.HTTP_201_CREATED,
)
def apply(
    opportunity_id: uuid.UUID,
    payload: ApplicationCreate,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> ApplicationOut:
    volunteer = require_profile(db, identity.user_id, Role.volunteer)
    item = db.get(Opportunity, opportunity_id)
    if not item or item.status != OpportunityStatus.published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Opportunity not found")
    application = Application(
        id=uuid.uuid4(),
        opportunity_id=opportunity_id,
        volunteer_id=volunteer.id,
        note=payload.note,
        experience=payload.experience,
        availability=payload.availability,
    )
    db.add(application)
    db.add(
        ApplicationStatusHistory(
            application_id=application.id,
            from_status=None,
            to_status=ApplicationStatus.received,
            changed_by=volunteer.id,
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
    items = db.scalars(
        opportunity_query()
        .where(Opportunity.organisation_id == organiser.organisation.id)
        .order_by(Opportunity.starts_at)
    ).unique().all()
    return [to_opportunity_out(db, item, organiser) for item in items]


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
    if not db.get(Suburb, payload.suburb_id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown suburb")
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
    return to_opportunity_out(db, loaded, organiser)


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
    return to_opportunity_out(db, item, organiser)


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
    return to_opportunity_out(db, item, organiser)


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
    return to_opportunity_out(db, item, organiser)


@router.get("/organiser/opportunities/{opportunity_id}/pipeline", response_model=PipelineOut)
def application_pipeline(
    opportunity_id: uuid.UUID,
    stage: ApplicationStatus | None = None,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> PipelineOut:
    organiser = require_profile(db, identity.user_id, Role.organiser)
    require_owned_opportunity(db, opportunity_id, organiser.id)
    statement = (
        select(Application)
        .options(*application_options())
        .where(Application.opportunity_id == opportunity_id)
        .order_by(Application.created_at)
    )
    items = list(db.scalars(statement).all())
    counts = {status: 0 for status in ApplicationStatus}
    for item in items:
        counts[item.status] += 1
    if stage:
        items = [item for item in items if item.status == stage]
    return PipelineOut(counts=counts, applications=[to_application_out(item) for item in items])


@router.patch("/organiser/applications/{application_id}", response_model=ApplicationOut)
def transition_application(
    application_id: uuid.UUID,
    payload: ApplicationTransition,
    identity: Identity = Depends(current_identity),
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
    return to_application_out(item)


@router.post(
    "/organiser/opportunities/{opportunity_id}/image-upload", response_model=UploadOut
)
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
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "File extension does not match type")
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
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Storage could not create an upload") from exc
    public = f"{settings.supabase_url}/storage/v1/object/public/{object_path}"
    return UploadOut(path=path, token=signed["token"], public_url=public)
