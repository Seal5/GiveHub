import math
import uuid
from collections.abc import Iterable
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload

from givehub.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusHistory,
    Cause,
    Opportunity,
    Profile,
    Role,
    SavedOpportunity,
    WaiverAcceptance,
    WaiverDocument,
)
from givehub.schemas import (
    ApplicationOut,
    CauseOut,
    OpportunityOut,
    StatusHistoryOut,
    WaiverAcceptanceOut,
)

NEXT_STEPS = {
    ApplicationStatus.received: "Your application was received. The host will review it next.",
    ApplicationStatus.under_review: "The host is considering your application.",
    ApplicationStatus.confirmed: "You’re in. Review the meeting point and event details.",
    ApplicationStatus.waitlisted: "You’re on the waitlist. We’ll show any future status change here.",
    ApplicationStatus.declined: "The host could not offer a place for this event.",
    ApplicationStatus.withdrawn: "You withdrew this application.",
}

ALLOWED_TRANSITIONS = {
    ApplicationStatus.received: {
        ApplicationStatus.under_review,
        ApplicationStatus.confirmed,
        ApplicationStatus.waitlisted,
        ApplicationStatus.declined,
        ApplicationStatus.withdrawn,
    },
    ApplicationStatus.under_review: {
        ApplicationStatus.confirmed,
        ApplicationStatus.waitlisted,
        ApplicationStatus.declined,
        ApplicationStatus.withdrawn,
    },
    ApplicationStatus.waitlisted: {
        ApplicationStatus.confirmed,
        ApplicationStatus.declined,
        ApplicationStatus.withdrawn,
    },
    ApplicationStatus.confirmed: {ApplicationStatus.withdrawn},
    ApplicationStatus.declined: set(),
    ApplicationStatus.withdrawn: set(),
}


def require_profile(db: Session, user_id: uuid.UUID, role: Role | None = None) -> Profile:
    profile = db.get(Profile, user_id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Complete your GiveHub profile first")
    if role is not None and profile.role != role:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"{role.value.title()} access required")
    return profile


def haversine_km(
    origin_latitude: float,
    origin_longitude: float,
    destination_latitude: float,
    destination_longitude: float,
) -> float:
    radius = 6371.0088
    lat1, lon1, lat2, lon2 = map(
        math.radians,
        (origin_latitude, origin_longitude, destination_latitude, destination_longitude),
    )
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1
    value = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    )
    return radius * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def opportunity_query() -> Select[tuple[Opportunity]]:
    return select(Opportunity).options(
        selectinload(Opportunity.organisation),
        selectinload(Opportunity.causes),
    )


def confirmed_count(db: Session, opportunity_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count(Application.id)).where(
                Application.opportunity_id == opportunity_id,
                Application.status == ApplicationStatus.confirmed,
            )
        )
        or 0
    )


def to_opportunity_out(
    db: Session,
    item: Opportunity,
    origin: tuple[float, float] | None = None,
    saved_ids: set[uuid.UUID] | None = None,
) -> OpportunityOut:
    distance = None
    if origin:
        distance = round(
            haversine_km(origin[0], origin[1], item.latitude, item.longitude), 1
        )
    return OpportunityOut(
        id=item.id,
        title=item.title,
        description=item.description,
        impact_statement=item.impact_statement,
        tasks=item.tasks,
        meeting_point=item.meeting_point,
        starts_at=item.starts_at,
        ends_at=item.ends_at,
        recurrence=item.recurrence,
        effort=item.effort,
        minimum_age=item.minimum_age,
        accessibility=item.accessibility,
        safety_notes=item.safety_notes,
        capacity=item.capacity,
        requires_waiver=item.requires_waiver,
        confirmed_count=confirmed_count(db, item.id),
        image_url=item.image_url,
        status=item.status,
        version=item.version,
        organisation_name=item.organisation.name,
        location_label=item.location_label,
        address_line=item.address_line,
        locality=item.locality,
        city=item.city,
        postcode=item.postcode,
        country_code=item.country_code,
        latitude=item.latitude,
        longitude=item.longitude,
        location_visibility=item.location_visibility,
        causes=[CauseOut.model_validate(cause) for cause in item.causes],
        distance_km=distance,
        is_saved=item.id in (saved_ids or set()),
    )


def saved_opportunity_ids(db: Session, profile_id: uuid.UUID) -> set[uuid.UUID]:
    return set(
        db.scalars(
            select(SavedOpportunity.opportunity_id).where(SavedOpportunity.profile_id == profile_id)
        ).all()
    )


def active_waiver(db: Session, organisation_id: uuid.UUID | None) -> WaiverDocument | None:
    """Returns the organisation's own active waiver, falling back to the platform default."""
    own = db.scalar(
        select(WaiverDocument)
        .where(
            WaiverDocument.organisation_id == organisation_id,
            WaiverDocument.is_active.is_(True),
        )
        .order_by(WaiverDocument.version.desc())
    )
    if own:
        return own
    return db.scalar(
        select(WaiverDocument)
        .where(WaiverDocument.organisation_id.is_(None), WaiverDocument.is_active.is_(True))
        .order_by(WaiverDocument.version.desc())
    )


def to_waiver_acceptance_out(item: Application) -> WaiverAcceptanceOut | None:
    acceptance = item.waiver_acceptance
    if acceptance is None:
        return None
    return WaiverAcceptanceOut(
        signed_name=acceptance.signed_name,
        is_minor=acceptance.is_minor,
        guardian_name=acceptance.guardian_name,
        guardian_email=acceptance.guardian_email,
        guardian_relationship=acceptance.guardian_relationship,
        accepted_at=acceptance.accepted_at,
        waiver_version=acceptance.waiver_document.version,
        waiver_title=acceptance.waiver_document.title,
    )


def to_application_out(item: Application) -> ApplicationOut:
    return ApplicationOut(
        id=item.id,
        opportunity_id=item.opportunity_id,
        opportunity_title=item.opportunity.title,
        volunteer_id=item.volunteer_id,
        volunteer_name=item.volunteer.display_name,
        volunteer_email=item.volunteer.email,
        note=item.note,
        experience=item.experience,
        availability=item.availability,
        status=item.status,
        version=item.version,
        next_step=NEXT_STEPS[item.status],
        history=[StatusHistoryOut.model_validate(entry) for entry in item.history],
        waiver=to_waiver_acceptance_out(item),
    )


def application_options() -> tuple[Any, ...]:
    return (
        selectinload(Application.opportunity),
        selectinload(Application.volunteer),
        selectinload(Application.history),
        selectinload(Application.waiver_acceptance).selectinload(
            WaiverAcceptance.waiver_document
        ),
        selectinload(Application.attendance),
    )


def change_application_status(
    db: Session,
    application: Application,
    new_status: ApplicationStatus,
    actor_id: uuid.UUID,
    expected_version: int,
) -> None:
    if application.version != expected_version:
        raise HTTPException(status.HTTP_409_CONFLICT, "Application changed; refresh and try again")
    if new_status not in ALLOWED_TRANSITIONS[application.status]:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot move an application from {application.status.value} to {new_status.value}",
        )
    if new_status == ApplicationStatus.confirmed:
        db.refresh(application, attribute_names=["opportunity"])
        if confirmed_count(db, application.opportunity_id) >= application.opportunity.capacity:
            raise HTTPException(status.HTTP_409_CONFLICT, "This opportunity is already full")
    previous = application.status
    application.status = new_status
    application.version += 1
    db.add(
        ApplicationStatusHistory(
            application_id=application.id,
            from_status=previous,
            to_status=new_status,
            changed_by=actor_id,
        )
    )


def require_causes(db: Session, cause_ids: Iterable[uuid.UUID]) -> list[Cause]:
    ids = list(dict.fromkeys(cause_ids))
    causes = list(db.scalars(select(Cause).where(Cause.id.in_(ids))).all())
    if len(causes) != len(ids):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "One or more causes are invalid")
    return causes


def require_owned_opportunity(db: Session, opportunity_id: uuid.UUID, owner_id: uuid.UUID) -> Opportunity:
    item = db.scalar(opportunity_query().where(Opportunity.id == opportunity_id))
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Opportunity not found")
    if item.organisation.owner_id != owner_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not manage this opportunity")
    return item
