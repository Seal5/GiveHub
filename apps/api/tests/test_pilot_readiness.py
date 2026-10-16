import uuid
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from givehub.config import Settings, get_settings
from givehub.lifecycle import expire_application_details
from givehub.main import app
from givehub.models import (
    Application,
    ApplicationStatus,
    Opportunity,
    Profile,
    Recurrence,
    Role,
    SourceCandidate,
    SourcePolicy,
    WaiverAcceptance,
)
from givehub.seed import DEMO_ORGANISER_ID, DEMO_VOLUNTEER_ID
from givehub.source_refresh import refresh_existing_sources, run_refresh


def test_new_host_requires_review_before_publishing(
    client: TestClient, db: Session, identity_override
) -> None:
    identity_override(uuid.uuid4())
    response = client.post(
        "/v1/profiles",
        json={
            "role": "organiser",
            "display_name": "New host",
            "email": "new-host@example.com",
            "organisation_name": "New Host Organization",
        },
    )
    assert response.status_code == 201
    assert response.json()["organisation_verification_status"] == "pending"
    host = db.get(Profile, uuid.UUID(response.json()["id"]))
    assert host and host.organisation
    identity_override(DEMO_ORGANISER_ID)
    review = client.put(
        f"/v1/review/organisations/{host.organisation.id}",
        json={
            "status": "approved",
            "note": "Host identity and authorization checked against pilot records.",
        },
    )
    assert review.status_code == 200
    db.refresh(host.organisation)
    assert host.organisation.reviewed_by == DEMO_ORGANISER_ID


def test_reviewer_cannot_self_approve_or_use_unlisted_production_account(
    client: TestClient, db: Session, identity_override
) -> None:
    identity_override(DEMO_ORGANISER_ID)
    host = db.get(Profile, DEMO_ORGANISER_ID)
    assert host and host.organisation
    own = client.put(
        f"/v1/review/organisations/{host.organisation.id}",
        json={"status": "approved", "note": "Reviewed my own organization identity"},
    )
    assert own.status_code == 403
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_env="production", source_reviewer_emails=[]
    )
    for route in ["organisations", "source-policies", "deletion-requests"]:
        assert client.get(f"/v1/review/{route}").status_code == 403


def test_imported_draft_cannot_publish_until_details_are_confirmed(
    client: TestClient, db: Session, identity_override
) -> None:
    identity_override(DEMO_ORGANISER_ID)
    candidate = SourceCandidate(
        source_name="Example",
        source_url="https://example.org/opportunity",
        title="Community pantry support",
        organisation_name="Pantry",
        location_label="Toronto",
        summary="Sort donated groceries and prepare pantry hampers.",
    )
    db.add(candidate)
    db.commit()
    draft = client.post(f"/v1/organiser/source-candidates/{candidate.id}/promote", json={}).json()
    assert draft["unconfirmed_fields"]
    assert client.post(f"/v1/organiser/opportunities/{draft['id']}/publish").status_code == 422
    incomplete = client.patch(
        f"/v1/organiser/opportunities/{draft['id']}",
        json={"version": draft["version"], "confirm_import_details": True},
    )
    assert incomplete.status_code == 422
    starts = datetime.now(UTC) + timedelta(days=7)
    confirmed = client.patch(
        f"/v1/organiser/opportunities/{draft['id']}",
        json={
            "version": draft["version"],
            "confirm_import_details": True,
            "starts_at": starts.isoformat(),
            "ends_at": (starts + timedelta(hours=2)).isoformat(),
            "capacity": 12,
            "minimum_age": 18,
            "latitude": 43.65,
            "longitude": -79.38,
            "meeting_point": "Pantry reception desk",
            "eligibility_notes": "Adults aged 18 and over.",
            "safety_notes": "Wear closed shoes and follow the pantry safety briefing.",
            "external_application_url": "https://example.org/apply",
        },
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["unconfirmed_fields"] == []
    assert client.post(f"/v1/organiser/opportunities/{draft['id']}/publish").status_code == 200


def test_http_availability_does_not_verify_a_listing(db: Session) -> None:
    listing = db.scalar(
        select(Opportunity).where(Opportunity.listing_source_url.contains("volunteersuccess.com"))
    )
    assert listing
    listing.listing_verification_status = "pending"
    client = httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(200)))
    refresh_existing_sources(db, client, checked_at=datetime.now(UTC))
    assert listing.source_checked_at is not None
    assert listing.listing_verification_status == "pending"


def test_disabled_source_never_fetches_or_discovers(db: Session) -> None:
    for host in [
        "volunteersuccess.com",
        "www.volunteersuccess.com",
        "jamii.ca",
        "www.jamii.ca",
        "unitedwaygt.org",
        "www.unitedwaygt.org",
    ]:
        db.add(SourcePolicy(host=host, enabled=False, permission_reference="Permission withdrawn"))
    db.commit()
    calls = []
    client = httpx.Client(
        transport=httpx.MockTransport(
            lambda request: calls.append(str(request.url)) or httpx.Response(200)
        )
    )
    run_refresh(
        db,
        client=client,
        postal_code="M5V 2T6",
        radius_km=50,
        pages=1,
        checked_at=datetime.now(UTC),
    )
    assert calls == []


def test_data_export_is_private_and_account_deletion_disables_access(
    client: TestClient, db: Session, identity_override
) -> None:
    # A second member's private application must not be returned in this export.
    other = Profile(
        id=uuid.uuid4(),
        role=Role.volunteer,
        display_name="Other volunteer",
        email="other@example.com",
    )
    db.add(other)
    db.commit()
    export = client.get("/v1/profiles/me/data")
    assert export.status_code == 200
    assert export.json()["profile"]["id"] == str(DEMO_VOLUNTEER_ID)
    assert "other@example.com" not in export.text
    assert client.post("/v1/profiles/me/deletion-request").json()["status"] == "pending"
    assert client.get("/v1/review/deletion-requests").status_code == 403
    identity_override(DEMO_ORGANISER_ID)
    assert (
        client.post(f"/v1/review/deletion-requests/{DEMO_VOLUNTEER_ID}/complete").status_code == 200
    )
    identity_override(DEMO_VOLUNTEER_ID)
    assert client.get("/v1/profiles/me").status_code == 404
    assert client.get("/v1/profiles/me/data").status_code == 404
    db.expire_all()
    deleted = db.get(Profile, DEMO_VOLUNTEER_ID)
    assert deleted and deleted.display_name == "Deleted member"
    assert deleted.email != "volunteer@example.com"


def test_retention_dry_run_and_execution(client: TestClient, db: Session, signed_waiver) -> None:
    opportunity = client.get("/v1/opportunities", params={"application_mode": "internal"}).json()[0]
    response = client.post(
        f"/v1/opportunities/{opportunity['id']}/applications",
        json={
            "note": "Personal application information",
            "waiver": signed_waiver(opportunity["id"]),
        },
    )
    item = db.get(Application, uuid.UUID(response.json()["id"]))
    assert item
    item.status = ApplicationStatus.withdrawn
    item.updated_at = datetime.now(UTC) - timedelta(days=120)
    db.commit()
    assert expire_application_details(db, days=90, now=datetime.now(UTC), apply=False) == 1
    assert item.note == "Personal application information"
    assert expire_application_details(db, days=90, now=datetime.now(UTC), apply=True) == 1
    db.expire_all()
    assert (
        db.scalar(select(WaiverAcceptance).where(WaiverAcceptance.application_id == item.id))
        is None
    )
    assert item.note == "Removed under the data lifecycle policy"


def test_recurring_sessions_keep_separate_hours(
    client: TestClient, db: Session, identity_override, signed_waiver
) -> None:
    opportunity = client.get("/v1/opportunities", params={"application_mode": "internal"}).json()[0]
    event = db.get(Opportunity, uuid.UUID(opportunity["id"]))
    assert event
    event.recurrence = Recurrence.weekly
    db.commit()
    application = client.post(
        f"/v1/opportunities/{event.id}/applications",
        json={
            "note": "I will attend these weekly sessions.",
            "waiver": signed_waiver(str(event.id)),
        },
    ).json()
    identity_override(DEMO_ORGANISER_ID)
    assert (
        client.patch(
            f"/v1/organiser/applications/{application['id']}",
            json={"status": "confirmed", "version": 1},
        ).status_code
        == 200
    )
    first = event.starts_at.replace(tzinfo=UTC).astimezone(ZoneInfo("America/Toronto")).date()
    second = first + timedelta(days=7)
    for day, hours in [(first, 2), (second, 3)]:
        assert (
            client.put(
                f"/v1/organiser/applications/{application['id']}/attendance",
                json={"status": "attended", "hours": hours, "session_date": str(day)},
            ).status_code
            == 200
        )
    assert (
        client.get(
            f"/v1/organiser/opportunities/{event.id}/attendance",
            params={"session_date": str(first)},
        ).json()["total_hours"]
        == 2
    )
    assert (
        client.get(
            f"/v1/organiser/opportunities/{event.id}/attendance",
            params={"session_date": str(second)},
        ).json()["total_hours"]
        == 3
    )
    assert (
        client.put(
            f"/v1/organiser/applications/{application['id']}/attendance",
            json={"status": "attended", "session_date": str(first + timedelta(days=1))},
        ).status_code
        == 422
    )
    identity_override(DEMO_VOLUNTEER_ID)
    impact = client.get("/v1/volunteers/me/impact").json()
    assert impact["events_attended"] == 2
    assert impact["total_hours"] == 5
