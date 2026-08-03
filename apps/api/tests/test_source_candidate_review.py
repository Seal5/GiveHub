import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from givehub.config import Settings, get_settings
from givehub.main import app
from givehub.models import Opportunity, OpportunityStatus, SourceCandidate
from givehub.seed import DEMO_ORGANISER_ID


def add_candidate(db: Session, **overrides: str) -> SourceCandidate:
    candidate = SourceCandidate(
        source_name="Volunteer Toronto",
        source_url=overrides.pop("source_url", "https://example.org/opportunities/pantry"),
        title=overrides.pop("title", "Community pantry support"),
        organisation_name=overrides.pop("organisation_name", "Neighbourhood Pantry"),
        location_label=overrides.pop("location_label", "Scarborough, Toronto"),
        summary=overrides.pop("summary", "Sort donations and prepare grocery hampers for local families."),
        **overrides,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


def test_review_queue_requires_an_organiser(client: TestClient, db: Session) -> None:
    add_candidate(db)
    response = client.get("/v1/organiser/source-candidates")
    assert response.status_code == 403


def test_reviewer_can_search_edit_and_reject_candidates(
    client: TestClient, db: Session, identity_override
) -> None:
    identity_override(DEMO_ORGANISER_ID)
    candidate = add_candidate(db)

    response = client.get("/v1/organiser/source-candidates?q=pantry")
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [str(candidate.id)]

    response = client.patch(
        f"/v1/organiser/source-candidates/{candidate.id}",
        json={"location_label": "Scarborough, Ontario", "summary": "Updated source details for this community food programme."},
    )
    assert response.status_code == 200
    assert response.json()["location_label"] == "Scarborough, Ontario"

    response = client.post(f"/v1/organiser/source-candidates/{candidate.id}/reject")
    assert response.status_code == 200
    assert response.json()["review_status"] == "rejected"
    assert response.json()["reviewed_at"] is not None


def test_reviewer_promotes_candidate_to_safe_external_draft(
    client: TestClient, db: Session, identity_override
) -> None:
    identity_override(DEMO_ORGANISER_ID)
    candidate = add_candidate(db)

    response = client.post(
        f"/v1/organiser/source-candidates/{candidate.id}/promote",
        json={"allow_duplicate": False},
    )
    assert response.status_code == 201
    item = response.json()
    assert item["status"] == "draft"
    assert item["organisation_name"] == "Neighbourhood Pantry"
    assert item["application_mode"] == "external"
    assert item["external_application_url"] == candidate.source_url
    assert item["listing_source"] == "Volunteer Toronto"
    assert item["listing_verification_status"] == "pending"

    db.expire_all()
    refreshed = db.get(SourceCandidate, candidate.id)
    assert refreshed is not None
    assert refreshed.review_status == "approved"
    assert refreshed.promoted_opportunity_id == uuid.UUID(item["id"])

    repeated = client.post(
        f"/v1/organiser/source-candidates/{candidate.id}/promote",
        json={"allow_duplicate": False},
    )
    assert repeated.status_code == 409


def test_duplicate_requires_explicit_override(
    client: TestClient, db: Session, identity_override
) -> None:
    identity_override(DEMO_ORGANISER_ID)
    candidate = add_candidate(
        db,
        title="Woodbine Beach Cleanup",
        organisation_name="Toronto Community Action Network",
        source_url="https://example.org/opportunities/woodbine",
    )

    queue_item = client.get("/v1/organiser/source-candidates").json()[0]
    assert queue_item["duplicates"][0]["title"] == "Woodbine Beach Cleanup"

    blocked = client.post(
        f"/v1/organiser/source-candidates/{candidate.id}/promote",
        json={"allow_duplicate": False},
    )
    assert blocked.status_code == 409

    allowed = client.post(
        f"/v1/organiser/source-candidates/{candidate.id}/promote",
        json={"allow_duplicate": True},
    )
    assert allowed.status_code == 201
    promoted = db.scalar(
        select(Opportunity).where(Opportunity.id == uuid.UUID(allowed.json()["id"]))
    )
    assert promoted is not None
    assert promoted.status == OpportunityStatus.draft


def test_production_review_access_uses_email_allowlist(
    client: TestClient, db: Session, identity_override
) -> None:
    identity_override(DEMO_ORGANISER_ID)
    add_candidate(db)
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_env="production", source_reviewer_emails=["reviewer@example.com"]
    )

    response = client.get("/v1/organiser/source-candidates")
    assert response.status_code == 403
