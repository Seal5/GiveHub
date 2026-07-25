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
    Suburb,
)
from givehub.schemas import (
    ApplicationOut,
    CauseOut,
    OpportunityOut,
    StatusHistoryOut,
    SuburbOut,
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


def haversine_km(origin: Suburb, destination: Suburb) -> float:
    radius = 6371.0088
    lat1, lon1, lat2, lon2 = map(
        math.radians,
        (origin.latitude, origin.longitude, destination.latitude, destination.longitude),
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
        selectinload(Opportunity.suburb),
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
    viewer: Profile | None = None,
    saved_ids: set[uuid.UUID] | None = None,
) -> OpportunityOut:
    distance = None
    if viewer and viewer.suburb:
        distance = round(haversine_km(viewer.suburb, item.suburb), 1)
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
        confirmed_count=confirmed_count(db, item.id),
        image_url=item.image_url,
        status=item.status,
        version=item.version,
        organisation_name=item.organisation.name,
        suburb=SuburbOut.model_validate(item.suburb),
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
    )


def application_options() -> tuple[Any, Any, Any]:
    return (
        selectinload(Application.opportunity),
        selectinload(Application.volunteer),
        selectinload(Application.history),
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
