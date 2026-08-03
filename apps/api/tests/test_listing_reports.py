import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from givehub.models import ListingReport, ListingReportStatus, Opportunity, OpportunityStatus
from givehub.seed import DEMO_ORGANISER_ID, DEMO_VOLUNTEER_ID


def first_opportunity(client: TestClient) -> dict:
    return client.get("/v1/opportunities").json()[0]


def test_volunteer_can_report_once_while_report_is_pending(
    client: TestClient, db: Session
) -> None:
    opportunity = first_opportunity(client)
    response = client.post(
        f"/v1/opportunities/{opportunity['id']}/reports",
        json={"reason": "broken_link", "details": "The external application page returns an error."},
    )
    assert response.status_code == 201
    assert response.json()["status"] == "pending"
    assert response.json()["opportunity_title"] == opportunity["title"]
    assert response.json()["reporter_name"] == "Mia Thompson"

    duplicate = client.post(
        f"/v1/opportunities/{opportunity['id']}/reports",
        json={"reason": "outdated"},
    )
    assert duplicate.status_code == 409
    assert db.query(ListingReport).count() == 1


def test_report_reason_is_validated(client: TestClient) -> None:
    opportunity = first_opportunity(client)
    response = client.post(
        f"/v1/opportunities/{opportunity['id']}/reports",
        json={"reason": "not-a-real-reason"},
    )
    assert response.status_code == 422


def test_organiser_can_dismiss_and_volunteer_can_report_again(
    client: TestClient, db: Session, identity_override
) -> None:
    opportunity = first_opportunity(client)
    report = client.post(
        f"/v1/opportunities/{opportunity['id']}/reports",
        json={"reason": "outdated", "details": "The schedule looks old."},
    ).json()

    identity_override(DEMO_ORGANISER_ID)
    queue = client.get("/v1/organiser/listing-reports")
    assert queue.status_code == 200
    assert [item["id"] for item in queue.json()] == [report["id"]]
    reviewed = client.post(
        f"/v1/organiser/listing-reports/{report['id']}/moderate",
        json={"action": "dismiss", "resolution_note": "The source confirms the date."},
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["status"] == "dismissed"

    identity_override(DEMO_VOLUNTEER_ID)
    repeated = client.post(
        f"/v1/opportunities/{opportunity['id']}/reports",
        json={"reason": "cancelled", "details": "The host now says it is cancelled."},
    )
    assert repeated.status_code == 201
    assert repeated.json()["id"] == report["id"]
    assert db.get(ListingReport, uuid.UUID(report["id"])).status == ListingReportStatus.pending


def test_unpublish_resolution_removes_listing_from_discovery(
    client: TestClient, db: Session, identity_override
) -> None:
    opportunity = first_opportunity(client)
    report = client.post(
        f"/v1/opportunities/{opportunity['id']}/reports",
        json={"reason": "safety_accessibility", "details": "The access information conflicts with the source."},
    ).json()

    identity_override(DEMO_ORGANISER_ID)
    response = client.post(
        f"/v1/organiser/listing-reports/{report['id']}/moderate",
        json={"action": "unpublish", "resolution_note": "Hidden while the host confirms details."},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "resolved"
    assert all(
        item["id"] != opportunity["id"]
        for item in client.get("/v1/opportunities").json()
    )
    stored = db.get(Opportunity, uuid.UUID(opportunity["id"]))
    assert stored is not None
    assert stored.status == OpportunityStatus.unpublished


def test_volunteer_cannot_open_moderation_queue(client: TestClient) -> None:
    assert client.get("/v1/organiser/listing-reports").status_code == 403
