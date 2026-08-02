import httpx
from fastapi.testclient import TestClient

from givehub.config import Settings, get_settings
from givehub.main import app
from givehub.seed import DEMO_ORGANISER_ID


def test_health_and_ready(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/ready").status_code == 200


def test_opportunities_are_distance_ordered(client: TestClient) -> None:
    response = client.get("/v1/opportunities")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 30
    distances = [item["distance_km"] for item in data]
    assert distances == sorted(distances)
    assert any(item["organisation_name"] == "Toronto Community Action Network" for item in data)


def test_opportunities_support_coordinate_radius_filtering(client: TestClient) -> None:
    response = client.get("/v1/opportunities?lat=43.6532&lng=-79.3832&radius_km=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3
    assert all(item["distance_km"] <= 10 for item in data)
    assert data == sorted(data, key=lambda item: item["distance_km"])

    wider = client.get("/v1/opportunities?lat=43.6532&lng=-79.3832&radius_km=50")
    assert wider.status_code == 200
    assert len(wider.json()) == 30
    assert client.get("/v1/opportunities?lat=43.6532").status_code == 422


def test_volunteer_can_save_search_location(client: TestClient) -> None:
    response = client.put(
        "/v1/profiles/me/preferences",
        json={
            "search_location_label": "Mississauga",
            "search_latitude": 43.5890,
            "search_longitude": -79.6441,
            "search_radius_km": 10,
            "theme": "system",
        },
    )
    assert response.status_code == 200
    assert response.json()["search_location_label"] == "Mississauga"
    assert response.json()["search_radius_km"] == 10


def test_free_location_search_returns_greater_toronto_addresses(
    client: TestClient,
    monkeypatch,
) -> None:
    captured: dict[str, object] = {}

    def photon_autocomplete(url: str, **kwargs: object) -> httpx.Response:
        captured.update({"url": url, **kwargs})
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            json={
                "features": [
                    {
                        "properties": {
                            "name": "Example Road",
                            "street": "Example Road",
                            "housenumber": "6862",
                            "city": "Toronto",
                            "postcode": "M5V 2T6",
                            "countrycode": "CA",
                        },
                        "geometry": {"coordinates": [-79.3832, 43.6532]},
                    }
                ]
            },
        )

    monkeypatch.setattr("givehub.api.httpx.get", photon_autocomplete)
    response = client.get("/v1/locations/autocomplete?q=6862")

    assert response.status_code == 200
    suggestion = response.json()[0]
    assert suggestion["label"] == "6862 Example Road, Toronto, M5V 2T6"
    assert suggestion["place_id"].startswith("photon-")
    assert captured["url"] == "https://photon.komoot.io/api/"
    assert captured["params"] == {
        "q": "6862",
        "countrycode": "CA",
        "bbox": "-79.95,43.40,-78.90,44.10",
        "limit": 6,
        "lang": "en",
    }

    resolved = client.get(f"/v1/locations/places/{suggestion['place_id']}")
    assert resolved.status_code == 200
    assert resolved.json()["address_line"] == "6862 Example Road"
    assert resolved.json()["latitude"] == 43.6532


def test_google_places_autocomplete_returns_address_predictions(
    client: TestClient,
    monkeypatch,
) -> None:
    captured: dict[str, object] = {}

    def google_autocomplete(url: str, **kwargs: object) -> httpx.Response:
        captured.update({"url": url, **kwargs})
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "suggestions": [
                    {
                        "placePrediction": {
                            "placeId": "google-place-6862",
                            "text": {"text": "6862 Example Road, Toronto, Canada"},
                        }
                    }
                ]
            },
        )

    app.dependency_overrides[get_settings] = lambda: Settings(
        google_places_api_key="test-google-key"
    )
    monkeypatch.setattr("givehub.api.httpx.post", google_autocomplete)

    response = client.get("/v1/locations/autocomplete?q=6862")

    assert response.status_code == 200
    assert response.json() == [
        {"place_id": "google-place-6862", "label": "6862 Example Road, Toronto, Canada"}
    ]
    assert captured["url"] == "https://places.googleapis.com/v1/places:autocomplete"
    assert captured["json"] == {
        "input": "6862",
        "includedRegionCodes": ["ca"],
        "locationRestriction": {
            "rectangle": {
                "low": {"latitude": 43.40, "longitude": -79.95},
                "high": {"latitude": 44.10, "longitude": -78.90},
            }
        },
    }


def test_volunteer_can_save_and_apply(client: TestClient, signed_waiver) -> None:
    item = client.get(
        "/v1/opportunities", params={"application_mode": "internal"}
    ).json()[0]
    opportunity_id = item["id"]
    assert client.put(f"/v1/opportunities/{opportunity_id}/saved").status_code == 204
    assert client.get("/v1/opportunities?saved=true").json()[0]["is_saved"] is True
    response = client.post(
        f"/v1/opportunities/{opportunity_id}/applications",
        json={
            "note": "I would love to help care for Toronto’s waterfront.",
            "experience": "I have joined two community cleanups.",
            "availability": "Available for the full event",
            "waiver": signed_waiver(opportunity_id),
        },
    )
    assert response.status_code == 201
    assert response.json()["status"] == "received"
    duplicate = client.post(
        f"/v1/opportunities/{opportunity_id}/applications",
        json={
            "note": "A second application should not be accepted.",
            "waiver": signed_waiver(opportunity_id),
        },
    )
    assert duplicate.status_code == 409


def test_organiser_moves_application_through_pipeline(
    client: TestClient, identity_override, signed_waiver
) -> None:
    opportunity_id = client.get(
        "/v1/opportunities", params={"application_mode": "internal"}
    ).json()[0]["id"]
    applied = client.post(
        f"/v1/opportunities/{opportunity_id}/applications",
        json={
            "note": "I can help throughout the entire event and bring gloves.",
            "waiver": signed_waiver(opportunity_id),
        },
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


def test_opportunity_funnel_analytics_and_csv_export(
    client: TestClient, identity_override, signed_waiver
) -> None:
    opportunity = client.get(
        "/v1/opportunities", params={"application_mode": "internal"}
    ).json()[0]
    opportunity_id = opportunity["id"]
    assert (
        client.post(
            f"/v1/opportunities/{opportunity_id}/events",
            json={"event_type": "viewed"},
        ).status_code
        == 204
    )
    assert (
        client.post(
            f"/v1/opportunities/{opportunity_id}/events",
            json={"event_type": "application_started"},
        ).status_code
        == 204
    )
    applied = client.post(
        f"/v1/opportunities/{opportunity_id}/applications",
        json={
            "note": '=HYPERLINK("unsafe.example", "I can help")',
            "experience": "First aid and community gardening",
            "availability": "Available during the daytime",
            "waiver": signed_waiver(opportunity_id),
        },
    )
    assert applied.status_code == 201

    identity_override(DEMO_ORGANISER_ID)
    analytics = client.get(f"/v1/organiser/opportunities/{opportunity_id}/analytics")
    assert analytics.status_code == 200
    assert analytics.json() == {
        "views": 1,
        "application_starts": 1,
        "applications_submitted": 1,
        "shares": 0,
        "view_to_application_rate": 100.0,
    }
    overview = client.get("/v1/organiser/analytics")
    assert overview.status_code == 200
    assert overview.json()["applications_submitted"] == 1

    filtered = client.get(
        f"/v1/organiser/opportunities/{opportunity_id}/pipeline",
        params={"stage": "received", "q": "first aid", "availability": "daytime"},
    )
    assert filtered.status_code == 200
    assert len(filtered.json()["applications"]) == 1
    exported = client.get(
        f"/v1/organiser/opportunities/{opportunity_id}/applications.csv",
        params={"stage": "received", "q": "first aid"},
    )
    assert exported.status_code == 200
    assert exported.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=" in exported.headers["content-disposition"]
    assert "Mia Thompson" in exported.text
    assert "First aid and community gardening" in exported.text
    assert "'=HYPERLINK" in exported.text


def test_application_and_status_change_send_email(
    client: TestClient, identity_override, monkeypatch, signed_waiver
) -> None:
    sent: list[dict[str, object]] = []

    def capture_email(
        _settings, *, recipient: str, subject: str, text: str, **extra: object
    ) -> bool:
        sent.append({"recipient": recipient, "subject": subject, "text": text, **extra})
        return True

    monkeypatch.setattr("givehub.api.send_email", capture_email)
    opportunity_id = client.get(
        "/v1/opportunities", params={"application_mode": "internal"}
    ).json()[0]["id"]
    applied = client.post(
        f"/v1/opportunities/{opportunity_id}/applications",
        json={
            "note": "I would be glad to help throughout the entire event.",
            "waiver": signed_waiver(opportunity_id),
        },
    )
    assert applied.status_code == 201

    by_recipient = {message["recipient"]: message for message in sent}
    assert "New GiveHub application" in str(by_recipient["organiser@example.com"]["subject"])
    # The volunteer now gets their own confirmation rather than silence until a decision.
    volunteer_receipt = by_recipient["volunteer@example.com"]
    assert "Application received" in str(volunteer_receipt["subject"])
    assert "<html>" in str(volunteer_receipt["html"])

    sent.clear()
    identity_override(DEMO_ORGANISER_ID)
    confirmed = client.patch(
        f"/v1/organiser/applications/{applied.json()['id']}",
        json={"status": "confirmed", "version": 1},
    )
    assert confirmed.status_code == 200
    decision = sent[0]
    assert decision["recipient"] == "volunteer@example.com"
    assert "confirmed" in str(decision["subject"])
    # Confirmation carries the practical detail volunteers need on the day.
    assert "Meeting point" in str(decision["text"])
    assert "organiser@example.com" in str(decision["text"])
    attachments = decision["attachments"]
    assert isinstance(attachments, tuple) and len(attachments) == 1
    assert attachments[0].filename == "givehub-event.ics"
    assert b"BEGIN:VEVENT" in attachments[0].content
