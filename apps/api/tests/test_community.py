import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from givehub.community import process_deliveries
from givehub.community_models import GatheringDelivery, GatheringRSVP
from givehub.config import Settings, get_settings
from givehub.database import Base, get_db
from givehub.main import app
from givehub.models import Organisation, Profile, Role, VerificationStatus
from givehub.seed import DEMO_ORGANISER_ID, DEMO_VOLUNTEER_ID, seed_reference_data


def payload(**changes):
    day = (datetime.now(UTC) + timedelta(days=10)).strftime("%Y-%m-%d")
    return {"title": "Community supper", "description": "Good food and good company", "location": "Secret kitchen, Toronto", "timezone": "America/Toronto", "starts_local": f"{day}T18:00", "ends_local": f"{day}T21:00", "theme": "citrus", "capacity": 2, "max_plus_ones": 1, "address_after_rsvp": True, "questions": [{"id": "diet", "label": "Dietary needs?", "required": True}], **changes}


def create(client, identity_override, **changes):
    identity_override(DEMO_ORGANISER_ID)
    response = client.post("/v1/organiser/community/events", json=payload(**changes))
    assert response.status_code == 201, response.text
    event = response.json()
    return event


def publish(client, event):
    response = client.post(f"/v1/organiser/community/events/{event['id']}/status", json={"status": "published", "version": event["version"]})
    assert response.status_code == 200, response.text
    return response.json()


def rsvp(client, event, email="guest@example.com", key=None, **changes):
    return client.post(f"/v1/community/events/{event['id']}/rsvp", json={"name": "Guest One", "email": email, "choice": "going", "plus_ones": 0, "answers": {"diet": "Vegetarian"}, "email_updates": True, **changes}, headers={"X-GiveHub-RSVP-Key": key} if key else {})


def test_draft_privacy_publish_and_optimistic_edits(client, identity_override):
    event = create(client, identity_override)
    assert client.get(f"/v1/community/events/{event['id']}").status_code == 404
    assert client.get(f"/g/{event['id']}").status_code == 404
    event = publish(client, event)
    assert client.get(f"/v1/community/events/{event['id']}").status_code == 200
    update = payload(title="A changed title", version=event["version"])
    assert client.put(f"/v1/organiser/community/events/{event['id']}", json=update).status_code == 200
    assert client.put(f"/v1/organiser/community/events/{event['id']}", json=update).status_code == 409


def test_rsvp_private_answers_edit_link_and_no_email_hijacking(client, identity_override):
    event = publish(client, create(client, identity_override))
    result = rsvp(client, event)
    assert result.status_code == 201, result.text
    key = result.json()["edit_key"]
    public = client.get(f"/v1/community/events/{event['id']}").json()
    assert public["location"] == ""
    assert public["my_rsvp"] is None
    assert "email" not in str(public["guests"])
    assert "Vegetarian" not in str(public)
    private = client.get(f"/v1/community/events/{event['id']}", headers={"X-GiveHub-RSVP-Key": key}).json()
    assert private["location"] == event["location"]
    assert private["my_rsvp"]["answers"] == {"diet": "Vegetarian"}
    assert rsvp(client, event).status_code == 409
    assert rsvp(client, event, key="a-forged-key").status_code == 403
    changed = rsvp(client, event, key=key, choice="maybe").json()
    assert changed["rsvp"]["status"] == "maybe"
    assert changed["edit_key"] is None
    assert client.get(f"/v1/community/events/{event['id']}", headers={"X-GiveHub-RSVP-Key": key}).json()["my_rsvp"]["status"] == "maybe"


def test_waitlist_party_size_and_automatic_promotion(client, identity_override):
    event = publish(client, create(client, identity_override))
    first = rsvp(client, event, plus_ones=1).json()
    waiting = rsvp(client, event, "second@example.com").json()
    assert waiting["rsvp"]["status"] == "waitlisted"
    rsvp(client, event, key=first["edit_key"], choice="declined")
    refreshed = client.get(f"/v1/community/events/{event['id']}", headers={"X-GiveHub-RSVP-Key": waiting["edit_key"]}).json()
    assert refreshed["my_rsvp"]["status"] == "going"
    assert refreshed["going"] == 1


def test_approval_privacy_and_host_ownership(client, identity_override, db: Session):
    event = publish(client, create(client, identity_override, approval_required=True, guest_list_visible=False))
    result = rsvp(client, event).json()
    assert result["rsvp"]["status"] == "pending"
    private = client.get(f"/v1/community/events/{event['id']}", headers={"X-GiveHub-RSVP-Key": result["edit_key"]}).json()
    assert private["location_hidden"]
    guest_id = result["rsvp"]["id"]
    assert client.patch(f"/v1/organiser/community/events/{event['id']}/guests/{guest_id}", json={"status": "going"}).status_code == 200
    public = client.get(f"/v1/community/events/{event['id']}").json()
    assert public["guests"] == []
    identity_override(DEMO_VOLUNTEER_ID)
    assert client.get(f"/v1/organiser/community/events/{event['id']}/guests").status_code == 403
    other = Profile(id=uuid.uuid4(), role=Role.organiser, display_name="Other", email="other@example.com")
    db.add(other)
    db.commit()
    identity_override(other.id)
    assert client.get(f"/v1/organiser/community/events/{event['id']}").status_code == 404


def test_validation_required_questions_plus_ones_and_dst(client, identity_override):
    event = publish(client, create(client, identity_override))
    assert rsvp(client, event, answers={}).status_code == 400
    assert rsvp(client, event, plus_ones=2).status_code == 400
    for start, end in [("2027-03-14T02:30", "2027-03-14T04:30"), ("2026-11-01T01:30", "2026-11-01T03:30"), ("2027-03-15T18:00", "2027-03-15T17:00")]:
        response = client.post("/v1/organiser/community/events", json=payload(starts_local=start, ends_local=end))
        assert response.status_code == 422, response.text


def test_pending_organizer_cannot_publish(client, identity_override, db):
    event = create(client, identity_override)
    org = db.scalar(select(Organisation).where(Organisation.owner_id == DEMO_ORGANISER_ID))
    org.verification_status = VerificationStatus.pending
    db.commit()
    assert client.post(f"/v1/organiser/community/events/{event['id']}/status", json={"status": "published", "version": event["version"]}).status_code == 403


def test_announcement_reminders_preview_delivery_and_cancellation(client, identity_override, db):
    event = publish(client, create(client, identity_override))
    rsvp(client, event)
    event_id = uuid.UUID(event["id"])
    jobs = db.scalars(select(GatheringDelivery).where(GatheringDelivery.gathering_id == event_id)).all()
    assert len(jobs) == 1 and jobs[0].kind == "reminder"
    # Another guest's RSVP must not erase the first guest's scheduled reminder.
    rsvp(client, event, "second@example.com", email_updates=False)
    assert len(db.scalars(select(GatheringDelivery).where(GatheringDelivery.gathering_id == event_id)).all()) == 1
    assert client.post(f"/v1/organiser/community/events/{event['id']}/announcements", json={"body": "Bring your reusable mug!"}).status_code == 201
    assert process_deliveries(db, Settings(resend_api_key=""), event_id) == 1
    assert process_deliveries(db, Settings(resend_api_key=""), event_id) == 0
    previews = client.get(f"/v1/organiser/community/events/{event['id']}/deliveries").json()
    assert any(d["state"] == "preview" for d in previews)
    assert "Bring your reusable mug!" in str(client.get(f"/v1/community/events/{event['id']}").json()["announcements"])
    assert client.post(f"/v1/organiser/community/events/{event['id']}/status", json={"status": "cancelled", "version": event["version"]}).status_code == 200
    assert rsvp(client, event, "third@example.com").status_code == 409
    assert not db.scalar(select(GatheringDelivery.id).where(GatheringDelivery.gathering_id == event_id, GatheringDelivery.kind == "reminder", GatheringDelivery.state == "queued"))


def test_capacity_cannot_shrink_and_guest_cannot_be_forced_to_attend(client, identity_override):
    event = publish(client, create(client, identity_override))
    rsvp(client, event, plus_ones=1)
    response = client.put(f"/v1/organiser/community/events/{event['id']}", json=payload(capacity=1, version=event["version"]))
    assert response.status_code == 400
    maybe = rsvp(client, event, "maybe@example.com", choice="maybe").json()["rsvp"]
    assert client.patch(f"/v1/organiser/community/events/{event['id']}/guests/{maybe['id']}", json={"status": "going"}).status_code == 409
    assert client.patch(f"/v1/organiser/community/events/{event['id']}/guests/{maybe['id']}", json={"status": "waitlisted"}).status_code == 409


def test_calendar_and_share_do_not_leak_private_address(client, identity_override):
    app.dependency_overrides[get_settings] = lambda: Settings(public_web_url="https://givehub.example")
    event = publish(client, create(client, identity_override))
    calendar = client.get(f"/v1/community/events/{event['id']}/calendar")
    assert calendar.status_code == 200
    assert "BEGIN:VEVENT" in calendar.text
    assert "Secret kitchen" not in calendar.text
    assert "Secret kitchen" not in client.get(f"/g/{event['id']}").text
    assert "Continue in your browser" in client.get(f"/g/{event['id']}").text


def test_guest_csv_and_export_do_not_expose_edit_hash(client, identity_override):
    event = publish(client, create(client, identity_override))
    rsvp(client, event, name="=HYPERLINK(1)")
    response = client.get(f"/v1/organiser/community/events/{event['id']}/guests.csv")
    assert response.status_code == 200 and "'=HYPERLINK" in response.text
    assert "edit_hash" not in response.text
    assert "edit_hash" not in client.get(f"/v1/organiser/community/events/{event['id']}/guests").text


def test_unlisted_event_available_by_link_but_not_discovery(client, identity_override):
    event = publish(client, create(client, identity_override, listed=False))
    assert event["id"] not in [g["id"] for g in client.get("/v1/community/events").json()]
    assert client.get(f"/v1/community/events/{event['id']}").status_code == 200


def test_signed_in_volunteer_rsvp_links_to_account_and_uses_account_email(client, identity_override):
    event = publish(client, create(client, identity_override))
    headers = {"Authorization": f"Bearer dev:{DEMO_VOLUNTEER_ID}"}
    data = {"name": "Mia Thompson", "email": "volunteer@example.com", "answers": {"diet": "None"}}
    response = client.post(f"/v1/community/events/{event['id']}/rsvp", json=data, headers=headers)
    assert response.status_code == 201, response.text
    assert client.get(f"/v1/community/events/{event['id']}", headers=headers).json()["my_rsvp"]["name"] == "Mia Thompson"
    identity_override(DEMO_VOLUNTEER_ID)
    export = client.get("/v1/profiles/me/data").json()
    assert export["community_rsvps"][0]["name"] == "Mia Thompson"
    assert "edit_hash" not in str(export)


def test_concurrent_final_spot_is_not_overbooked(client, identity_override, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'capacity.db'}", connect_args={"check_same_thread": False, "timeout": 10})
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        seed_reference_data(session)
    previous = app.dependency_overrides[get_db]
    def file_db():
        with Session(engine, expire_on_commit=False) as session:
            yield session
    app.dependency_overrides[get_db] = file_db
    try:
        event = publish(client, create(client, identity_override, capacity=1, max_plus_ones=0))
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda email: rsvp(client, event, email), ["first@example.com", "second@example.com"]))
        assert [r.status_code for r in responses] == [201, 201]
        assert sorted(r.json()["rsvp"]["status"] for r in responses) == ["going", "waitlisted"]
        assert client.get(f"/v1/community/events/{event['id']}").json()["going"] == 1
    finally:
        app.dependency_overrides[get_db] = previous
        engine.dispose()


def test_changing_email_through_private_link_revokes_email_verification(client, identity_override, db):
    event = publish(client, create(client, identity_override))
    result = rsvp(client, event).json()
    guest = db.get(GatheringRSVP, uuid.UUID(result["rsvp"]["id"]))
    guest.email_verified = True
    db.commit()
    assert rsvp(client, event, email="changed@example.com", key=result["edit_key"]).status_code == 201
    db.expire_all()
    assert not db.get(GatheringRSVP, guest.id).email_verified


def test_account_removal_revokes_guest_capability_and_removes_answers(client, identity_override, db):
    event = publish(client, create(client, identity_override))
    response = client.post(f"/v1/community/events/{event['id']}/rsvp", json={"name": "Mia Thompson", "email": "volunteer@example.com", "answers": {"diet": "Private dietary answer"}}, headers={"Authorization": f"Bearer dev:{DEMO_VOLUNTEER_ID}"})
    assert response.status_code == 201
    key = response.json()["edit_key"]
    identity_override(DEMO_VOLUNTEER_ID)
    assert client.post("/v1/profiles/me/deletion-request").status_code == 200
    identity_override(DEMO_ORGANISER_ID)
    assert client.post(f"/v1/review/deletion-requests/{DEMO_VOLUNTEER_ID}/complete").status_code == 200
    assert client.get(f"/v1/community/events/{event['id']}", headers={"X-GiveHub-RSVP-Key": key}).status_code == 403
    assert not db.scalar(select(GatheringRSVP.id).where(GatheringRSVP.profile_id == DEMO_VOLUNTEER_ID))
