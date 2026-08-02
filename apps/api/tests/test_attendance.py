from fastapi.testclient import TestClient

from givehub.seed import DEMO_ORGANISER_ID, DEMO_VOLUNTEER_ID


def confirmed_application(client: TestClient, identity_override, signed_waiver) -> tuple[str, str]:
    """Applies as the volunteer and confirms as the organiser, returning both ids."""
    opportunity_id = client.get(
        "/v1/opportunities", params={"application_mode": "internal"}
    ).json()[0]["id"]
    applied = client.post(
        f"/v1/opportunities/{opportunity_id}/applications",
        json={
            "note": "I can help for the whole morning at the bay.",
            "waiver": signed_waiver(opportunity_id),
        },
    ).json()
    identity_override(DEMO_ORGANISER_ID)
    confirmed = client.patch(
        f"/v1/organiser/applications/{applied['id']}",
        json={"status": "confirmed", "version": 1},
    )
    assert confirmed.status_code == 200
    return opportunity_id, applied["id"]


def test_attendance_sheet_lists_confirmed_volunteers(
    client: TestClient, identity_override, signed_waiver
) -> None:
    opportunity_id, application_id = confirmed_application(client, identity_override, signed_waiver)
    sheet = client.get(f"/v1/organiser/opportunities/{opportunity_id}/attendance")
    assert sheet.status_code == 200
    data = sheet.json()
    assert data["expected"] == 1
    assert data["attended"] == 0
    assert data["default_hours"] == 3.0
    assert data["rows"][0]["application_id"] == application_id
    assert data["rows"][0]["status"] == "expected"


def test_marking_attended_defaults_to_event_length(
    client: TestClient, identity_override, signed_waiver
) -> None:
    opportunity_id, application_id = confirmed_application(client, identity_override, signed_waiver)
    recorded = client.put(
        f"/v1/organiser/applications/{application_id}/attendance",
        json={"status": "attended"},
    )
    assert recorded.status_code == 200
    assert recorded.json()["hours"] == 3.0

    sheet = client.get(f"/v1/organiser/opportunities/{opportunity_id}/attendance").json()
    assert sheet["attended"] == 1
    assert sheet["total_hours"] == 3.0


def test_explicit_hours_override_the_default(
    client: TestClient, identity_override, signed_waiver
) -> None:
    _, application_id = confirmed_application(client, identity_override, signed_waiver)
    recorded = client.put(
        f"/v1/organiser/applications/{application_id}/attendance",
        json={"status": "attended", "hours": 1.5, "notes": "Left early"},
    )
    assert recorded.status_code == 200
    assert recorded.json()["hours"] == 1.5
    assert recorded.json()["notes"] == "Left early"


def test_no_show_clears_hours(client: TestClient, identity_override, signed_waiver) -> None:
    _, application_id = confirmed_application(client, identity_override, signed_waiver)
    client.put(
        f"/v1/organiser/applications/{application_id}/attendance",
        json={"status": "attended", "hours": 3},
    )
    corrected = client.put(
        f"/v1/organiser/applications/{application_id}/attendance",
        json={"status": "no_show", "hours": 3},
    )
    assert corrected.status_code == 200
    assert corrected.json()["hours"] == 0.0


def test_unconfirmed_volunteers_cannot_be_marked_off(
    client: TestClient, identity_override, signed_waiver
) -> None:
    opportunity_id = client.get(
        "/v1/opportunities", params={"application_mode": "internal"}
    ).json()[0]["id"]
    applied = client.post(
        f"/v1/opportunities/{opportunity_id}/applications",
        json={
            "note": "I can help for the whole morning at the bay.",
            "waiver": signed_waiver(opportunity_id),
        },
    ).json()
    identity_override(DEMO_ORGANISER_ID)
    response = client.put(
        f"/v1/organiser/applications/{applied['id']}/attendance",
        json={"status": "attended"},
    )
    assert response.status_code == 409


def test_impact_counts_only_attended_events(
    client: TestClient, identity_override, signed_waiver
) -> None:
    _, application_id = confirmed_application(client, identity_override, signed_waiver)

    identity_override(DEMO_VOLUNTEER_ID)
    before = client.get("/v1/volunteers/me/impact").json()
    assert before["events_attended"] == 0
    assert before["total_hours"] == 0
    # A confirmed but not-yet-run event shows as upcoming rather than contributed.
    assert before["upcoming_confirmed"] == 1

    identity_override(DEMO_ORGANISER_ID)
    client.put(
        f"/v1/organiser/applications/{application_id}/attendance",
        json={"status": "attended", "hours": 2.5},
    )

    identity_override(DEMO_VOLUNTEER_ID)
    after = client.get("/v1/volunteers/me/impact").json()
    assert after["events_attended"] == 1
    assert after["total_hours"] == 2.5
    assert after["organisations_supported"] == 1
    assert after["causes"][0]["slug"] == "monitoring"
    assert after["recent"][0]["hours"] == 2.5
    assert after["recent"][0]["organisation_name"] == "Toronto Community Action Network"


def test_impact_requires_a_volunteer_profile(client: TestClient, identity_override) -> None:
    identity_override(DEMO_ORGANISER_ID)
    assert client.get("/v1/volunteers/me/impact").status_code == 403


def test_attendance_is_scoped_to_the_owning_organiser(
    client: TestClient, identity_override, signed_waiver
) -> None:
    _, application_id = confirmed_application(client, identity_override, signed_waiver)
    identity_override(DEMO_VOLUNTEER_ID)
    response = client.put(
        f"/v1/organiser/applications/{application_id}/attendance",
        json={"status": "attended"},
    )
    assert response.status_code == 403
