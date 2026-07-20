
from fastapi.testclient import TestClient

from givehub.seed import DEMO_ORGANISER_ID


def test_health_and_ready(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/ready").status_code == 200


def test_opportunities_are_distance_ordered(client: TestClient) -> None:
    response = client.get("/v1/opportunities")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    distances = [item["distance_km"] for item in data]
    assert distances == sorted(distances)
    assert data[0]["organisation_name"] == "Kaitiaki Coastal Network"


def test_volunteer_can_save_and_apply(client: TestClient) -> None:
    item = client.get("/v1/opportunities").json()[0]
    opportunity_id = item["id"]
    assert client.put(f"/v1/opportunities/{opportunity_id}/saved").status_code == 204
    assert client.get("/v1/opportunities?saved=true").json()[0]["is_saved"] is True
    response = client.post(
        f"/v1/opportunities/{opportunity_id}/applications",
        json={
            "note": "I would love to help care for the Wellington coastline.",
            "experience": "I have joined two community cleanups.",
            "availability": "Available for the full event",
        },
    )
    assert response.status_code == 201
    assert response.json()["status"] == "received"
    duplicate = client.post(
        f"/v1/opportunities/{opportunity_id}/applications",
        json={"note": "A second application should not be accepted."},
    )
    assert duplicate.status_code == 409


def test_organiser_moves_application_through_pipeline(
    client: TestClient, identity_override
) -> None:
    opportunity_id = client.get("/v1/opportunities").json()[0]["id"]
    applied = client.post(
        f"/v1/opportunities/{opportunity_id}/applications",
        json={"note": "I can help throughout the entire event and bring gloves."},
    ).json()
    identity_override(DEMO_ORGANISER_ID)
    pipeline = client.get(f"/v1/organiser/opportunities/{opportunity_id}/pipeline")
    assert pipeline.status_code == 200
    assert pipeline.json()["counts"]["received"] == 1
    reviewed = client.patch(
        f"/v1/organiser/applications/{applied['id']}",
        json={"status": "under_review", "version": 1},
    )
    assert reviewed.status_code == 200
    confirmed = client.patch(
        f"/v1/organiser/applications/{applied['id']}",
        json={"status": "confirmed", "version": 2},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["next_step"].startswith("You’re in")


def test_role_authorization(client: TestClient) -> None:
    response = client.get("/v1/organiser/opportunities")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "http_403"

