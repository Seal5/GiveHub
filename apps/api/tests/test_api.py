
from fastapi.testclient import TestClient

from givehub.seed import DEMO_ORGANISER_ID


def test_health_and_ready(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/ready").status_code == 200


def test_opportunities_are_distance_ordered(client: TestClient) -> None:
    response = client.get("/v1/opportunities")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5
    distances = [item["distance_km"] for item in data]
    assert distances == sorted(distances)
    assert data[0]["organisation_name"] == "Kaitiaki Coastal Network"


def test_opportunities_support_coordinate_radius_filtering(client: TestClient) -> None:
    response = client.get(
        "/v1/opportunities?lat=-41.2866&lng=174.7756&radius_km=5"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert all(item["distance_km"] <= 5 for item in data)
    assert data == sorted(data, key=lambda item: item["distance_km"])

    wider = client.get(
        "/v1/opportunities?lat=-41.2866&lng=174.7756&radius_km=100"
    )
    assert wider.status_code == 200
    assert len(wider.json()) == 5
    assert client.get("/v1/opportunities?lat=-41.2866").status_code == 422


def test_volunteer_can_save_search_location(client: TestClient) -> None:
    response = client.put(
        "/v1/profiles/me/preferences",
        json={
            "search_location_label": "Lower Hutt",
            "search_latitude": -41.2092,
            "search_longitude": 174.9081,
            "search_radius_km": 10,
            "theme": "system",
        },
    )
    assert response.status_code == 200
    assert response.json()["search_location_label"] == "Lower Hutt"
    assert response.json()["search_radius_km"] == 10


def test_location_search_requires_provider_configuration(client: TestClient) -> None:
    response = client.get("/v1/locations/autocomplete?q=Wellington")
    assert response.status_code == 503


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

