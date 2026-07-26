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
    response = client.get("/v1/opportunities?lat=-41.2866&lng=174.7756&radius_km=5")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert all(item["distance_km"] <= 5 for item in data)
    assert data == sorted(data, key=lambda item: item["distance_km"])

    wider = client.get("/v1/opportunities?lat=-41.2866&lng=174.7756&radius_km=100")
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


def test_volunteer_can_save_and_apply(client: TestClient, signed_waiver) -> None:
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
    opportunity_id = client.get("/v1/opportunities").json()[0]["id"]
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
    opportunity = client.get("/v1/opportunities").json()[0]
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

    def capture_email(_settings, *, recipient: str, subject: str, text: str, **extra: object) -> bool:
        sent.append({"recipient": recipient, "subject": subject, "text": text, **extra})
        return True

    monkeypatch.setattr("givehub.api.send_email", capture_email)
    opportunity_id = client.get("/v1/opportunities").json()[0]["id"]
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
