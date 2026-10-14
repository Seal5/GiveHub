from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from givehub.api import profile_out, require_source_reviewer
from givehub.auth import Identity, current_identity
from givehub.config import Settings, get_settings
from givehub.database import get_db
from givehub.models import Organisation, SourcePolicy, VerificationStatus
from givehub.schemas import OrganisationReview, ProfileDetailsUpdate, ProfileOut, SourcePolicyUpdate
from givehub.services import require_profile

router = APIRouter(prefix="/v1")


@router.patch("/profiles/me", response_model=ProfileOut)
def update_profile_details(
    payload: ProfileDetailsUpdate,
    identity: Identity = Depends(current_identity),
    db: Session = Depends(get_db),
) -> ProfileOut:
    profile = require_profile(db, identity.user_id)
    profile.display_name = payload.display_name.strip()
    if len(profile.display_name) < 2:
        raise HTTPException(422, "Enter your name")
    db.commit()
    return profile_out(profile)


@router.get("/review/organisations")
def organisations_for_review(
    identity: Identity = Depends(current_identity),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    require_source_reviewer(db, identity, settings)
    return [
        {
            "id": str(o.id),
            "name": o.name,
            "contact_email": o.owner.email,
            "status": o.verification_status.value,
            "note": o.verification_note,
            "reviewed_at": o.reviewed_at,
        }
        for o in db.scalars(select(Organisation).order_by(Organisation.created_at)).all()
    ]


@router.put("/review/organisations/{organisation_id}")
def review_organisation(
    organisation_id: str,
    payload: OrganisationReview,
    identity: Identity = Depends(current_identity),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    import uuid

    reviewer = require_source_reviewer(db, identity, settings)
    if len(payload.note.strip()) < 10:
        raise HTTPException(422, "Record the review evidence and decision")
    try:
        key = uuid.UUID(organisation_id)
    except ValueError as exc:
        raise HTTPException(422, "Invalid organisation ID") from exc
    item = db.get(Organisation, key)
    if not item:
        raise HTTPException(404, "Organisation not found")
    if item.owner_id == reviewer.id:
        raise HTTPException(403, "Another reviewer must approve your organisation")
    item.verification_status = VerificationStatus(payload.status)
    item.verification_note = payload.note.strip()
    item.reviewed_by = reviewer.id
    item.reviewed_at = datetime.now(UTC)
    if item.verification_status == VerificationStatus.rejected:
        from givehub.models import OpportunityStatus

        for opportunity in item.opportunities:
            opportunity.status = OpportunityStatus.unpublished
            opportunity.version += 1
    db.commit()
    return {"status": item.verification_status.value}


@router.get("/review/source-policies")
def source_policies(
    identity: Identity = Depends(current_identity),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    require_source_reviewer(db, identity, settings)
    return [
        {
            "host": p.host,
            "enabled": p.enabled,
            "permission_reference": p.permission_reference,
            "reviewed_at": p.reviewed_at,
        }
        for p in db.scalars(select(SourcePolicy).order_by(SourcePolicy.host)).all()
    ]


@router.put("/review/source-policies/{host}")
def update_source_policy(
    host: str,
    payload: SourcePolicyUpdate,
    identity: Identity = Depends(current_identity),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    import re

    from givehub.source_refresh import CHECKABLE_HOSTS

    reviewer = require_source_reviewer(db, identity, settings)
    host = host.lower().strip()
    if not re.fullmatch(r"[a-z0-9]+(?:[.-][a-z0-9]+)*", host) or host not in CHECKABLE_HOSTS:
        raise HTTPException(422, "Choose a supported source hostname")
    policy = db.get(SourcePolicy, host) or SourcePolicy(host=host)
    policy.enabled = payload.enabled
    policy.permission_reference = payload.permission_reference.strip()
    if len(policy.permission_reference) < 10:
        raise HTTPException(422, "Record the authorization or review reference")
    policy.reviewed_by = reviewer.id
    policy.reviewed_at = datetime.now(UTC)
    db.add(policy)
    db.commit()
    return {"host": host}
