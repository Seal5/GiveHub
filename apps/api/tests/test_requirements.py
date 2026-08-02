from fastapi.testclient import TestClient

from givehub.seed import DEMO_ORGANISER_ID, DEMO_VOLUNTEER_ID


def test_opportunity_fit_filters_and_source_metadata(client: TestClient) -> None:
    compact = client.get(
        "/v1/opportunities",
        params={
            "max_time_commitment_minutes": 180,
            "accessible_only": True,
            "max_minimum_age": 17,
            "training_required": False,
            "screening_required": False,
        },
    )
    assert compact.status_code == 200
    assert compact.json()
    for item in compact.json():
        assert item["time_commitment_minutes"] <= 180
        assert item["is_accessible"] is True
        assert item["minimum_age"] <= 17
        assert item["training_required"] is False
        assert item["screening_required"] is False
        assert item["listing_source"]
        assert item["listing_verification_status"] in {"verified", "pending", "unverified"}
        assert item["updated_at"]

    external = client.get("/v1/opportunities", params={"application_mode": "external"}).json()
    assert len(external) == 20
    assert all(item["external_application_url"].startswith("https://") for item in external)


def test_showcase_data_covers_discovery_filters(client: TestClient) -> None:
    one_off = client.get("/v1/opportunities", params={"recurrence": "one_off"}).json()
    assert {item["title"] for item in one_off} >= {
        "High Park Pollinator Count",
        "Rouge Valley Trail Restoration",
    }

    short = client.get("/v1/opportunities", params={"max_time_commitment_minutes": 60}).json()
    assert "High Park Pollinator Count" in {item["title"] for item in short}
    assert all(item["time_commitment_minutes"] <= 60 for item in short)

    training = client.get("/v1/opportunities", params={"training_required": True}).json()
    assert {item["title"] for item in training} >= {
        "Don River Water Quality Monitoring",
        "Etobicoke Seniors Tech Help",
        "Markham Young Tree Care Day",
    }

    screening = client.get("/v1/opportunities", params={"screening_required": True}).json()
    assert {item["title"] for item in screening} >= {
        "Scarborough Newcomer Conversation Club",
        "Downtown Youth Meal Kit Packing",
    }


def test_external_application_answers_are_never_collected(client: TestClient) -> None:
    external = client.get("/v1/opportunities", params={"application_mode": "external"}).json()[0]
    response = client.post(
        f"/v1/opportunities/{external['id']}/applications",
        json={
            "note": "This answer must not be accepted or stored by GiveHub.",
            "experience": "Sensitive external response",
            "availability": "Full event",
        },
    )
    assert response.status_code == 409
    assert client.get("/v1/applications/me").json() == []


def test_volunteer_can_update_and_withdraw_application(client: TestClient, signed_waiver) -> None:
    internal = client.get("/v1/opportunities", params={"application_mode": "internal"}).json()[0]
    opportunity_id = internal["id"]
    applied = client.post(
        f"/v1/opportunities/{opportunity_id}/applications",
        json={
            "note": "I can help for the whole event and would like to join.",
            "experience": "Community volunteering",
            "availability": "Full event",
            "waiver": signed_waiver(opportunity_id),
        },
    ).json()
    updated = client.patch(
        f"/v1/applications/{applied['id']}",
        json={
            "note": "I can help for the whole event and bring useful equipment.",
            "experience": "Community volunteering and first aid",
            "availability": "Full event",
            "version": applied["version"],
        },
    )
    assert updated.status_code == 200
    assert updated.json()["experience"].endswith("first aid")

    withdrawn = client.post(
        f"/v1/applications/{applied['id']}/withdraw",
        json={"status": "withdrawn", "version": updated.json()["version"]},
    )
    assert withdrawn.status_code == 200
    assert withdrawn.json()["status"] == "withdrawn"


def test_organiser_can_disable_new_application_email(
    client: TestClient, identity_override, monkeypatch, signed_waiver
) -> None:
    sent_to: list[str] = []

    def capture_email(_settings, *, recipient: str, **_extra: object) -> bool:
        sent_to.append(recipient)
        return True

    opportunity_id = client.get(
        "/v1/opportunities", params={"application_mode": "internal"}
    ).json()[0]["id"]
    waiver = signed_waiver(opportunity_id)
    identity_override(DEMO_ORGANISER_ID)
    response = client.put(
        "/v1/organiser/notification-preferences",
        json={"notify_new_applications": False},
    )
    assert response.status_code == 200
    assert response.json() == {"notify_new_applications": False}

    monkeypatch.setattr("givehub.api.send_email", capture_email)
    identity_override(DEMO_VOLUNTEER_ID)
    applied = client.post(
        f"/v1/opportunities/{opportunity_id}/applications",
        json={
            "note": "I can help for the whole event and would like to join.",
            "waiver": waiver,
        },
    )
    assert applied.status_code == 201
    assert "volunteer@example.com" in sent_to
    assert "organiser@example.com" not in sent_to
