from fastapi.testclient import TestClient
from sqlalchemy import select

from givehub.models import WaiverDocument
from givehub.seed import DEMO_ORGANISER_ID, DEMO_VOLUNTEER_ID


def first_opportunity(client: TestClient) -> dict:
    return client.get("/v1/opportunities").json()[0]


def test_waiver_is_served_for_waiver_required_opportunities(client: TestClient) -> None:
    item = first_opportunity(client)
    assert item["requires_waiver"] is True
    response = client.get(f"/v1/opportunities/{item['id']}/waiver")
    assert response.status_code == 200
    waiver = response.json()
    assert waiver["version"] == 1
    assert waiver["title"] == "GiveHub volunteer agreement"
    assert "Accident Compensation Act" in waiver["body"]


def test_application_without_waiver_is_rejected(client: TestClient) -> None:
    item = first_opportunity(client)
    response = client.post(
        f"/v1/opportunities/{item['id']}/applications",
        json={"note": "I would like to help with the coastal cleanup."},
    )
    assert response.status_code == 422
    assert "waiver" in response.json()["error"]["message"].lower()


def test_unagreed_waiver_is_rejected(client: TestClient, signed_waiver) -> None:
    item = first_opportunity(client)
    response = client.post(
        f"/v1/opportunities/{item['id']}/applications",
        json={
            "note": "I would like to help with the coastal cleanup.",
            "waiver": signed_waiver(item["id"], agreed=False),
        },
    )
    assert response.status_code == 422


def test_minor_requires_guardian_details(client: TestClient, signed_waiver) -> None:
    item = first_opportunity(client)
    rejected = client.post(
        f"/v1/opportunities/{item['id']}/applications",
        json={
            "note": "I would like to help with the coastal cleanup.",
            "waiver": signed_waiver(item["id"], is_minor=True),
        },
    )
    assert rejected.status_code == 422

    accepted = client.post(
        f"/v1/opportunities/{item['id']}/applications",
        json={
            "note": "I would like to help with the coastal cleanup.",
            "waiver": signed_waiver(
                item["id"],
                is_minor=True,
                guardian_name="Ana Thompson",
                guardian_email="guardian@example.com",
                guardian_relationship="Parent",
            ),
        },
    )
    assert accepted.status_code == 201
    waiver = accepted.json()["waiver"]
    assert waiver["is_minor"] is True
    assert waiver["guardian_email"] == "guardian@example.com"
    assert waiver["waiver_version"] == 1


def test_acceptance_records_the_signed_version(client: TestClient, signed_waiver) -> None:
    item = first_opportunity(client)
    response = client.post(
        f"/v1/opportunities/{item['id']}/applications",
        json={
            "note": "I would like to help with the coastal cleanup.",
            "waiver": signed_waiver(item["id"], signed_name="Mia Thompson"),
        },
    )
    assert response.status_code == 201
    waiver = response.json()["waiver"]
    assert waiver["signed_name"] == "Mia Thompson"
    assert waiver["accepted_at"]
    assert waiver["waiver_title"] == "GiveHub volunteer agreement"


def test_stale_waiver_version_is_rejected(
    client: TestClient, identity_override, signed_waiver
) -> None:
    item = first_opportunity(client)
    stale = signed_waiver(item["id"])

    identity_override(DEMO_ORGANISER_ID)
    published = client.put(
        "/v1/organiser/waiver",
        json={
            "title": "Kaitiaki Coastal Network volunteer agreement",
            "body": "Our own terms for coastal restoration volunteering. " * 3,
        },
    )
    assert published.status_code == 200
    assert published.json()["version"] == 1

    identity_override(DEMO_VOLUNTEER_ID)
    response = client.post(
        f"/v1/opportunities/{item['id']}/applications",
        json={"note": "I would like to help with the coastal cleanup.", "waiver": stale},
    )
    assert response.status_code == 409


def test_organiser_waiver_versions_increment(client: TestClient, identity_override) -> None:
    identity_override(DEMO_ORGANISER_ID)
    body = "Our own terms for coastal restoration volunteering. " * 3
    first = client.put("/v1/organiser/waiver", json={"title": "Coastal waiver", "body": body})
    second = client.put(
        "/v1/organiser/waiver", json={"title": "Coastal waiver", "body": body + "Updated."}
    )
    assert first.json()["version"] == 1
    assert second.json()["version"] == 2
    assert client.get("/v1/organiser/waiver").json()["version"] == 2


def test_waiver_columns_are_exported(
    client: TestClient, identity_override, signed_waiver
) -> None:
    item = first_opportunity(client)
    applied = client.post(
        f"/v1/opportunities/{item['id']}/applications",
        json={
            "note": "I would like to help with the coastal cleanup.",
            "waiver": signed_waiver(
                item["id"],
                is_minor=True,
                guardian_name="Ana Thompson",
                guardian_email="guardian@example.com",
            ),
        },
    )
    assert applied.status_code == 201

    identity_override(DEMO_ORGANISER_ID)
    exported = client.get(f"/v1/organiser/opportunities/{item['id']}/applications.csv")
    assert exported.status_code == 200
    assert "Waiver signed at" in exported.text
    assert "Guardian email" in exported.text
    assert "guardian@example.com" in exported.text


def test_guardian_receives_consent_copy(client: TestClient, signed_waiver, monkeypatch) -> None:
    sent: list[dict[str, object]] = []

    def capture_email(_settings, *, recipient: str, subject: str, text: str, **extra: object) -> bool:
        sent.append({"recipient": recipient, "subject": subject, "text": text})
        return True

    monkeypatch.setattr("givehub.api.send_email", capture_email)
    item = first_opportunity(client)
    response = client.post(
        f"/v1/opportunities/{item['id']}/applications",
        json={
            "note": "I would like to help with the coastal cleanup.",
            "waiver": signed_waiver(
                item["id"],
                is_minor=True,
                guardian_name="Ana Thompson",
                guardian_email="guardian@example.com",
                guardian_relationship="Parent",
            ),
        },
    )
    assert response.status_code == 201
    guardian = next(m for m in sent if m["recipient"] == "guardian@example.com")
    assert "Guardian consent recorded" in str(guardian["subject"])
    assert "Mia Thompson" in str(guardian["text"])


def test_no_guardian_email_for_adult_volunteers(
    client: TestClient, signed_waiver, monkeypatch
) -> None:
    sent: list[str] = []

    def capture_email(_settings, *, recipient: str, **_: object) -> bool:
        sent.append(recipient)
        return True

    monkeypatch.setattr("givehub.api.send_email", capture_email)
    item = first_opportunity(client)
    client.post(
        f"/v1/opportunities/{item['id']}/applications",
        json={
            "note": "I would like to help with the coastal cleanup.",
            "waiver": signed_waiver(item["id"]),
        },
    )
    assert sorted(sent) == ["organiser@example.com", "volunteer@example.com"]


def test_existing_acceptances_keep_the_wording_they_were_signed_against(
    client: TestClient, identity_override, signed_waiver
) -> None:
    """The core audit property: rewriting a waiver must not retroactively change
    what an earlier volunteer is recorded as having agreed to."""
    item = first_opportunity(client)
    applied = client.post(
        f"/v1/opportunities/{item['id']}/applications",
        json={
            "note": "I would like to help with the coastal cleanup.",
            "waiver": signed_waiver(item["id"]),
        },
    )
    assert applied.status_code == 201
    assert applied.json()["waiver"]["waiver_title"] == "GiveHub volunteer agreement"
    assert applied.json()["waiver"]["waiver_version"] == 1

    identity_override(DEMO_ORGANISER_ID)
    body = "Our own coastal terms covering tides, boats, and shellfish safety. " * 2
    client.put("/v1/organiser/waiver", json={"title": "Coastal waiver", "body": body})
    client.put("/v1/organiser/waiver", json={"title": "Coastal waiver", "body": body + "Winter."})

    # New applicants see the rewritten agreement...
    identity_override(DEMO_VOLUNTEER_ID)
    current = client.get(f"/v1/opportunities/{item['id']}/waiver").json()
    assert current["title"] == "Coastal waiver"
    assert current["version"] == 2

    # ...while the earlier acceptance is unchanged.
    identity_override(DEMO_ORGANISER_ID)
    recorded = client.get(f"/v1/organiser/opportunities/{item['id']}/pipeline").json()
    waiver = recorded["applications"][0]["waiver"]
    assert waiver["waiver_title"] == "GiveHub volunteer agreement"
    assert waiver["waiver_version"] == 1


def test_organisations_cannot_edit_the_platform_default(
    client: TestClient, identity_override, db
) -> None:
    """Publishing scopes the new document to the organisation, leaving the shared
    default intact for every other host."""
    identity_override(DEMO_ORGANISER_ID)
    body = "Our own coastal terms covering tides, boats, and shellfish safety. " * 2
    published = client.put(
        "/v1/organiser/waiver", json={"title": "Coastal waiver", "body": body}
    )
    assert published.status_code == 200
    assert client.get("/v1/organiser/waiver").json()["title"] == "Coastal waiver"

    platform = list(
        db.scalars(select(WaiverDocument).where(WaiverDocument.organisation_id.is_(None))).all()
    )
    assert len(platform) == 1
    assert platform[0].title == "GiveHub volunteer agreement"
    assert platform[0].is_active is True
