"""Data access, requested account removal and configurable retention."""

import argparse
import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from givehub.api import profile_out, require_source_reviewer
from givehub.auth import Identity, current_identity
from givehub.community import guest_out
from givehub.community_models import Gathering, GatheringDelivery, GatheringMessage, GatheringRSVP
from givehub.config import Settings, get_settings
from givehub.database import SessionLocal, get_db
from givehub.models import (
    Application,
    ApplicationStatus,
    Attendance,
    ListingReport,
    Opportunity,
    OpportunityEvent,
    OpportunityStatus,
    Profile,
    SavedOpportunity,
    SessionAttendance,
    WaiverAcceptance,
)
from givehub.services import require_profile

router = APIRouter(prefix="/v1")


def own_rows(db: Session, model: Any, condition: Any) -> list[dict[str, Any]]:
    rows: list[Any] = list(db.scalars(select(model).where(condition)).all())
    return [
        {column.name: getattr(row, column.name) for column in model.__table__.columns}
        for row in rows
    ]


@router.get("/profiles/me/data")
def export_my_data(
    identity: Identity = Depends(current_identity), db: Session = Depends(get_db)
) -> dict[str, Any]:
    profile = require_profile(db, identity.user_id)
    applications = select(Application.id).where(Application.volunteer_id == profile.id)
    data: dict[str, Any] = {
        "profile": profile_out(profile).model_dump(mode="json"),
        "applications": own_rows(db, Application, Application.volunteer_id == profile.id),
        "waiver_acceptances": own_rows(
            db, WaiverAcceptance, WaiverAcceptance.application_id.in_(applications)
        ),
        "recurring_attendance": own_rows(
            db, SessionAttendance, SessionAttendance.application_id.in_(applications)
        ),
        "attendance": own_rows(db, Attendance, Attendance.application_id.in_(applications)),
        "saved_opportunities": own_rows(
            db, SavedOpportunity, SavedOpportunity.profile_id == profile.id
        ),
        "reports": own_rows(db, ListingReport, ListingReport.reporter_id == profile.id),
        "events": own_rows(db, OpportunityEvent, OpportunityEvent.profile_id == profile.id),
        "community_rsvps": [guest_out(g) for g in db.scalars(select(GatheringRSVP).where(GatheringRSVP.profile_id == profile.id)).all()],
        "hosted_community_events": own_rows(db, Gathering, Gathering.host_id == profile.id),
    }
    if profile.organisation:
        data["organisation"] = {
            "name": profile.organisation.name,
            "verification_status": profile.organisation.verification_status.value,
        }
        data["listings"] = own_rows(
            db, Opportunity, Opportunity.organisation_id == profile.organisation.id
        )
    return data


@router.post("/profiles/me/deletion-request")
def request_account_deletion(
    identity: Identity = Depends(current_identity), db: Session = Depends(get_db)
) -> dict[str, str]:
    profile = require_profile(db, identity.user_id)
    profile.deletion_requested_at = profile.deletion_requested_at or datetime.now(UTC)
    db.commit()
    return {
        "status": "pending",
        "message": "A reviewer will remove your GiveHub data and close your account. You can cancel while this request is pending.",
    }


@router.delete("/profiles/me/deletion-request")
def cancel_account_deletion(
    identity: Identity = Depends(current_identity), db: Session = Depends(get_db)
) -> dict[str, str]:
    profile = require_profile(db, identity.user_id)
    profile.deletion_requested_at = None
    db.commit()
    return {"status": "cancelled"}


def remove_application_details(db: Session, application: Application) -> None:
    application.note = "Removed under the data lifecycle policy"
    application.experience = ""
    application.availability = ""
    application.version += 1
    db.execute(delete(WaiverAcceptance).where(WaiverAcceptance.application_id == application.id))
    db.execute(delete(Attendance).where(Attendance.application_id == application.id))
    db.execute(delete(SessionAttendance).where(SessionAttendance.application_id == application.id))


@router.get("/review/deletion-requests")
def deletion_requests(
    identity: Identity = Depends(current_identity),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    require_source_reviewer(db, identity, settings)
    return [
        {
            "id": str(p.id),
            "name": p.display_name,
            "email": p.email,
            "requested_at": p.deletion_requested_at,
        }
        for p in db.scalars(
            select(Profile).where(
                Profile.deletion_requested_at.is_not(None), Profile.deleted_at.is_(None)
            )
        ).all()
    ]


@router.post("/review/deletion-requests/{profile_id}/complete")
def complete_account_deletion(
    profile_id: uuid.UUID,
    identity: Identity = Depends(current_identity),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    reviewer = require_source_reviewer(db, identity, settings)
    profile = db.get(Profile, profile_id)
    if not profile or not profile.deletion_requested_at or profile.deleted_at:
        raise HTTPException(404, "Pending deletion request not found")
    if reviewer.id == profile.id:
        raise HTTPException(403, "Another reviewer must complete your deletion")
    if settings.is_production:
        if not settings.supabase_url or not settings.supabase_secret_key:
            raise HTTPException(503, "Configure Supabase administration before closing accounts")
        try:
            response = httpx.delete(
                f"{settings.supabase_url}/auth/v1/admin/users/{profile.id}",
                headers={
                    "apikey": settings.supabase_secret_key,
                    "Authorization": f"Bearer {settings.supabase_secret_key}",
                },
                timeout=8,
            )
            if response.status_code != 404:
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(503, "Account provider removal failed; retry this request") from exc
    for application in db.scalars(
        select(Application).where(Application.volunteer_id == profile.id)
    ).all():
        remove_application_details(db, application)
        application.status = ApplicationStatus.withdrawn
        application.version += 1
    db.execute(delete(SavedOpportunity).where(SavedOpportunity.profile_id == profile.id))
    db.execute(delete(ListingReport).where(ListingReport.reporter_id == profile.id))
    db.execute(delete(OpportunityEvent).where(OpportunityEvent.profile_id == profile.id))
    guest_ids = select(GatheringRSVP.id).where(GatheringRSVP.profile_id == profile.id)
    db.execute(delete(GatheringDelivery).where(GatheringDelivery.rsvp_id.in_(guest_ids)))
    db.execute(delete(GatheringRSVP).where(GatheringRSVP.profile_id == profile.id))
    hosted_ids = select(Gathering.id).where(Gathering.host_id == profile.id)
    db.execute(update(Gathering).where(Gathering.host_id == profile.id).values(status="cancelled", data={"title": "Closed community event", "description": "The host closed their account", "location": "", "timezone": "America/Toronto", "starts_local": "", "ends_local": "", "theme": "moss", "cover_url": "", "capacity": None, "max_plus_ones": 0, "approval_required": False, "guest_list_visible": False, "address_after_rsvp": True, "listed": False, "reminder_enabled": False, "questions": []}))
    db.execute(delete(GatheringDelivery).where(GatheringDelivery.gathering_id.in_(hosted_ids)))
    db.execute(delete(GatheringMessage).where(GatheringMessage.gathering_id.in_(hosted_ids)))
    if profile.organisation:
        for item in profile.organisation.opportunities:
            item.status = OpportunityStatus.unpublished
            item.version += 1
        profile.organisation.name = "Closed organisation"
        profile.organisation.verification_note = ""
    profile.display_name = "Deleted member"
    profile.email = f"deleted-{profile.id}@example.com"
    profile.suburb_id = None
    profile.search_radius_km = 25
    profile.theme = "system"
    profile.max_time_commitment_minutes = None
    profile.accessible_only = False
    profile.training_preference = "any"
    profile.screening_preference = "any"
    profile.transportation_preference = "any"
    profile.search_location_label = None
    profile.search_latitude = profile.search_longitude = None
    profile.preferred_cause_slugs = []
    profile.preferred_availability = []
    profile.preferred_recurrences = []
    profile.age_group = None
    profile.deleted_at = datetime.now(UTC)
    db.commit()
    return {"status": "completed"}


def expire_application_details(db: Session, *, days: int, now: datetime, apply: bool) -> int:
    cutoff = now - timedelta(days=days)
    items = db.scalars(
        select(Application).where(
            Application.status.in_([ApplicationStatus.withdrawn, ApplicationStatus.declined]),
            Application.updated_at < cutoff,
            Application.note != "Removed under the data lifecycle policy",
        )
    ).all()
    if apply:
        for item in items:
            remove_application_details(db, item)
        db.commit()
    return len(items)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Remove expired declined/withdrawn application details and waiver/attendance records. Defaults to a dry run."
    )
    parser.add_argument(
        "--days", type=int, required=True, help="Use the team's approved retention period"
    )
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.days < 1:
        parser.error("--days must be positive")
    with SessionLocal() as db:
        count = expire_application_details(
            db, days=args.days, now=datetime.now(UTC), apply=args.apply
        )
    print(json.dumps({"applications": count, "applied": args.apply, "retention_days": args.days}))


if __name__ == "__main__":
    main()
