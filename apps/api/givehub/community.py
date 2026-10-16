"""Partiful-style invitations integrated with GiveHub organizer accounts."""

import base64
import csv
import hashlib
import io
import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from givehub.auth import Identity, bearer, current_identity
from givehub.community_models import Gathering, GatheringDelivery, GatheringMessage, GatheringRSVP
from givehub.config import Settings, get_settings
from givehub.database import get_db
from givehub.email import send_email
from givehub.formatting import as_utc
from givehub.models import Profile, Role, VerificationStatus
from givehub.services import require_profile
from givehub.sharing import _page

router = APIRouter()


class GuestQuestion(BaseModel):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    label: str = Field(min_length=1, max_length=200)
    required: bool = False


def wall_time(value: str, timezone: str) -> datetime:
    try:
        zone = ZoneInfo(timezone)
        local = datetime.strptime(value, "%Y-%m-%dT%H:%M")
    except (ValueError, ZoneInfoNotFoundError) as exc:
        raise ValueError("Use YYYY-MM-DDTHH:MM and a valid IANA timezone") from exc
    first = local.replace(tzinfo=zone, fold=0)
    second = local.replace(tzinfo=zone, fold=1)
    if first.astimezone(UTC).astimezone(zone).replace(tzinfo=None) != local:
        raise ValueError("That local time does not exist during the daylight-saving change")
    if first.utcoffset() != second.utcoffset():
        raise ValueError("That local time occurs twice. Choose a time outside the daylight-saving transition")
    return first.astimezone(UTC)


class GatheringInput(BaseModel):
    title: str = Field(min_length=3, max_length=100)
    description: str = Field(default="", max_length=5000)
    location: str = Field(default="", max_length=300)
    timezone: str = "America/Toronto"
    starts_local: str
    ends_local: str
    theme: Literal["citrus", "rose", "moss", "midnight"] = "moss"
    cover_url: str = ""
    capacity: int | None = Field(default=None, ge=1, le=100000)
    max_plus_ones: int = Field(default=0, ge=0, le=10)
    approval_required: bool = False
    guest_list_visible: bool = True
    address_after_rsvp: bool = False
    listed: bool = True
    reminder_enabled: bool = True
    questions: list[GuestQuestion] = Field(default_factory=list, max_length=10)
    version: int | None = None

    @field_validator("title", "description", "location")
    @classmethod
    def trim(cls, value: str) -> str:
        return value.strip()

    @field_validator("cover_url")
    @classmethod
    def safe_cover(cls, value: str) -> str:
        if value and not re.fullmatch(r"/v1/community/covers/[a-f0-9-]+\.(jpg|png|webp)", value):
            raise ValueError("Upload a GiveHub cover image first")
        return value

    @model_validator(mode="after")
    def valid_schedule(self) -> "GatheringInput":
        if wall_time(self.ends_local, self.timezone) <= wall_time(self.starts_local, self.timezone):
            raise ValueError("The event must end after it starts")
        if len({q.id for q in self.questions}) != len(self.questions):
            raise ValueError("Question IDs must be unique")
        if len(self.title) < 3:
            raise ValueError("Enter an event title")
        return self


class RSVPInput(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    choice: Literal["going", "maybe", "declined"] = "going"
    plus_ones: int = Field(default=0, ge=0, le=10)
    answers: dict[str, str] = Field(default_factory=dict, max_length=10)
    email_updates: bool = False

    @field_validator("answers")
    @classmethod
    def bound_answers(cls, value: dict[str, str]) -> dict[str, str]:
        if any(len(v) > 1000 for v in value.values()):
            raise ValueError("Keep each answer under 1,000 characters")
        return value


class GatheringState(BaseModel):
    status: Literal["draft", "published", "cancelled"]
    version: int


class GuestDecision(BaseModel):
    status: Literal["going", "waitlisted", "declined"]


class AnnouncementInput(BaseModel):
    body: str = Field(min_length=3, max_length=2000)


class CoverInput(BaseModel):
    data: str = Field(max_length=4_500_000)


def optional_identity(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
) -> Identity | None:
    return current_identity(credentials, settings) if credentials else None


def key_hash(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def load_event(db: Session, event_id: uuid.UUID, *, host_id: uuid.UUID | None = None, lock: bool = False) -> Gathering:
    if lock:
        # A real write obtains a SQLite writer lock; PostgreSQL also serializes on this row.
        db.execute(update(Gathering).where(Gathering.id == event_id).values(version=Gathering.version))
    item = db.get(Gathering, event_id, populate_existing=lock)
    if item is None or (host_id is not None and item.host_id != host_id):
        raise HTTPException(404, "Community event not found")
    return item


def host_profile(db: Session, identity: Identity) -> Profile:
    return require_profile(db, identity.user_id, Role.organiser)


def seats(db: Session, event_id: uuid.UUID, excluding: uuid.UUID | None = None) -> int:
    query = select(func.coalesce(func.sum(GatheringRSVP.plus_ones + 1), 0)).where(GatheringRSVP.gathering_id == event_id, GatheringRSVP.status == "going")
    if excluding:
        query = query.where(GatheringRSVP.id != excluding)
    return int(db.scalar(query) or 0)


def mine(db: Session, event_id: uuid.UUID, identity: Identity | None, key: str | None) -> GatheringRSVP | None:
    if key:
        found = db.scalar(select(GatheringRSVP).where(GatheringRSVP.gathering_id == event_id, GatheringRSVP.edit_hash == key_hash(key)))
        if found:
            return found
        raise HTTPException(403, "This private RSVP link is invalid")
    if identity:
        require_profile(db, identity.user_id)
        return db.scalar(select(GatheringRSVP).where(GatheringRSVP.gathering_id == event_id, GatheringRSVP.profile_id == identity.user_id))
    return None


def guest_out(guest: GatheringRSVP) -> dict[str, Any]:
    return {"id": guest.id, "name": guest.name, "email": guest.email, "choice": guest.choice, "status": guest.status, "plus_ones": guest.plus_ones, "answers": guest.answers, "email_updates": guest.email_updates, "updated_at": guest.updated_at}


def event_out(db: Session, item: Gathering, *, host: bool = False, guest: GatheringRSVP | None = None) -> dict[str, Any]:
    profile = db.get(Profile, item.host_id)
    hidden = not host and item.data["address_after_rsvp"] and (guest is None or guest.status != "going")
    visible_guests = db.scalars(select(GatheringRSVP).where(GatheringRSVP.gathering_id == item.id, GatheringRSVP.status == "going").order_by(GatheringRSVP.created_at)).all() if host or item.data["guest_list_visible"] else []
    return {**item.data, "location": "" if hidden else item.data["location"], "location_hidden": hidden,
            "id": item.id, "host_name": profile.organisation.name if profile and profile.organisation else "GiveHub community",
            "status": item.status, "version": item.version, "starts_at": as_utc(item.starts_at), "ends_at": as_utc(item.ends_at),
            "going": seats(db, item.id), "responses": db.scalar(select(func.count()).select_from(GatheringRSVP).where(GatheringRSVP.gathering_id == item.id)) or 0,
            "guests": [{"name": g.name, "plus_ones": g.plus_ones} for g in visible_guests],
            "announcements": [{"id": m.id, "body": m.body, "created_at": m.created_at} for m in db.scalars(select(GatheringMessage).where(GatheringMessage.gathering_id == item.id).order_by(GatheringMessage.created_at.desc())).all()]}


def queue(db: Session, item: Gathering, guest: GatheringRSVP, *, kind: str, dedupe: str, subject: str, body: str, due: datetime | None = None) -> None:
    if not guest.email_updates or guest.choice == "declined":
        return
    unique = f"{dedupe}:{guest.id}"
    if db.scalar(select(GatheringDelivery.id).where(GatheringDelivery.dedupe == unique)):
        return
    db.add(GatheringDelivery(gathering_id=item.id, rsvp_id=guest.id, kind=kind, dedupe=unique, subject=subject, body=body, due_at=due or datetime.now(UTC), state="queued"))
    db.flush()


def schedule_reminders(db: Session, item: Gathering) -> None:
    db.execute(delete(GatheringDelivery).where(GatheringDelivery.gathering_id == item.id, GatheringDelivery.kind == "reminder", GatheringDelivery.state.in_(["queued", "preview", "cancelled"])))
    if item.status != "published" or not item.data["reminder_enabled"] or as_utc(item.starts_at) <= datetime.now(UTC):
        return
    due = max(as_utc(item.starts_at) - timedelta(hours=24), datetime.now(UTC))
    for guest in db.scalars(select(GatheringRSVP).where(GatheringRSVP.gathering_id == item.id, GatheringRSVP.status == "going")).all():
        queue(db, item, guest, kind="reminder", dedupe=f"reminder:{as_utc(item.starts_at).isoformat()}", subject=f"Coming up: {item.data['title']}", body=f"{item.data['title']} starts {item.data['starts_local']} ({item.data['timezone']}).\n{item.data['location']}", due=due)


def promote(db: Session, item: Gathering) -> None:
    if item.status != "published":
        return
    for guest in db.scalars(select(GatheringRSVP).where(GatheringRSVP.gathering_id == item.id, GatheringRSVP.status == "waitlisted").order_by(GatheringRSVP.created_at, GatheringRSVP.id)).all():
        capacity = item.data["capacity"]
        if capacity is not None and seats(db, item.id) + 1 + guest.plus_ones > capacity:
            break
        guest.status = "going"
        guest.updated_at = datetime.now(UTC)
        db.flush()
        queue(db, item, guest, kind="status", dedupe=f"promoted:{uuid.uuid4()}", subject=f"You're in: {item.data['title']}", body="A spot opened up. Your RSVP is now Going.")


@router.get("/v1/community/events")
def community_events(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    items = db.scalars(select(Gathering).where(Gathering.status == "published", Gathering.ends_at > datetime.now(UTC)).order_by(Gathering.starts_at)).all()
    return [event_out(db, item) for item in items if item.data["listed"]]


@router.get("/v1/community/my-rsvps")
def my_community_rsvps(identity: Identity = Depends(current_identity), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    profile = require_profile(db, identity.user_id)
    result = []
    for guest in db.scalars(select(GatheringRSVP).where(GatheringRSVP.profile_id == profile.id).order_by(GatheringRSVP.updated_at.desc())).all():
        item = db.get(Gathering, guest.gathering_id)
        if item:
            result.append({**event_out(db, item, guest=guest), "my_rsvp": guest_out(guest)})
    return result


@router.get("/v1/organiser/community/events")
def hosted_events(identity: Identity = Depends(current_identity), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    host = host_profile(db, identity)
    return [event_out(db, item, host=True) for item in db.scalars(select(Gathering).where(Gathering.host_id == host.id).order_by(Gathering.created_at.desc())).all()]


@router.post("/v1/organiser/community/events", status_code=201)
def create_event(payload: GatheringInput, identity: Identity = Depends(current_identity), db: Session = Depends(get_db)) -> dict[str, Any]:
    host = host_profile(db, identity)
    item = Gathering(host_id=host.id, data=payload.model_dump(exclude={"version"}), starts_at=wall_time(payload.starts_local, payload.timezone), ends_at=wall_time(payload.ends_local, payload.timezone))
    db.add(item)
    db.commit()
    return event_out(db, item, host=True)


@router.get("/v1/organiser/community/events/{event_id}")
def hosted_event(event_id: uuid.UUID, identity: Identity = Depends(current_identity), db: Session = Depends(get_db)) -> dict[str, Any]:
    host = host_profile(db, identity)
    return event_out(db, load_event(db, event_id, host_id=host.id), host=True)


@router.put("/v1/organiser/community/events/{event_id}")
def update_event(event_id: uuid.UUID, payload: GatheringInput, identity: Identity = Depends(current_identity), db: Session = Depends(get_db)) -> dict[str, Any]:
    host = host_profile(db, identity)
    item = load_event(db, event_id, host_id=host.id, lock=True)
    if item.status == "cancelled" or item.version != payload.version:
        raise HTTPException(409, "This event changed or was cancelled. Reload before saving")
    if payload.capacity is not None and payload.capacity < seats(db, item.id):
        raise HTTPException(400, "Capacity cannot be below the number already confirmed")
    changed = any(item.data[k] != getattr(payload, k) for k in ("starts_local", "ends_local", "timezone", "location"))
    item.data = payload.model_dump(exclude={"version"})
    item.starts_at = wall_time(payload.starts_local, payload.timezone)
    item.ends_at = wall_time(payload.ends_local, payload.timezone)
    item.version += 1
    db.flush()
    if changed and item.status == "published":
        for guest in db.scalars(select(GatheringRSVP).where(GatheringRSVP.gathering_id == item.id, GatheringRSVP.status != "declined")).all():
            queue(db, item, guest, kind="update", dedupe=f"edited:{item.version}", subject=f"Plans updated: {payload.title}", body="The host updated the date, time or location. Open the invitation for the latest details.")
    promote(db, item)
    schedule_reminders(db, item)
    db.commit()
    return event_out(db, item, host=True)


@router.post("/v1/organiser/community/events/{event_id}/status")
def event_status(event_id: uuid.UUID, payload: GatheringState, identity: Identity = Depends(current_identity), db: Session = Depends(get_db)) -> dict[str, Any]:
    host = host_profile(db, identity)
    item = load_event(db, event_id, host_id=host.id, lock=True)
    if item.status == "cancelled" or item.version != payload.version:
        raise HTTPException(409, "This event changed or was cancelled. Refresh first")
    if payload.status == "published":
        if not host.organisation or host.organisation.verification_status != VerificationStatus.approved:
            raise HTTPException(403, "Your organization must be approved before publishing")
        if not item.data["description"].strip() or not item.data["location"].strip() or as_utc(item.ends_at) <= datetime.now(UTC):
            raise HTTPException(400, "Add a description, location and future event date before publishing")
    if payload.status == "draft" and db.scalar(select(GatheringRSVP.id).where(GatheringRSVP.gathering_id == item.id).limit(1)):
        raise HTTPException(409, "This event has RSVPs. Cancel it instead of hiding it")
    item.status = payload.status
    item.version += 1
    db.flush()
    if item.status == "cancelled":
        db.execute(update(GatheringDelivery).where(GatheringDelivery.gathering_id == item.id, GatheringDelivery.state == "queued").values(state="cancelled"))
        for guest in db.scalars(select(GatheringRSVP).where(GatheringRSVP.gathering_id == item.id, GatheringRSVP.status != "declined")).all():
            queue(db, item, guest, kind="cancelled", dedupe="cancelled", subject=f"Cancelled: {item.data['title']}", body="The host cancelled this event. Please do not attend.")
    schedule_reminders(db, item)
    db.commit()
    return event_out(db, item, host=True)


def public_event(db: Session, event_id: uuid.UUID, identity: Identity | None) -> Gathering:
    item = load_event(db, event_id)
    if item.status == "draft" and (not identity or identity.user_id != item.host_id):
        raise HTTPException(404, "Community event not found")
    return item


@router.get("/v1/community/events/{event_id}")
def invitation(event_id: uuid.UUID, identity: Identity | None = Depends(optional_identity), key: str | None = Header(None, alias="X-GiveHub-RSVP-Key"), db: Session = Depends(get_db)) -> dict[str, Any]:
    item = public_event(db, event_id, identity)
    guest = mine(db, event_id, identity, key)
    return {**event_out(db, item, host=bool(identity and identity.user_id == item.host_id), guest=guest), "my_rsvp": guest_out(guest) if guest else None}


@router.post("/v1/community/events/{event_id}/rsvp", status_code=201)
def rsvp(event_id: uuid.UUID, payload: RSVPInput, identity: Identity | None = Depends(optional_identity), key: str | None = Header(None, alias="X-GiveHub-RSVP-Key"), db: Session = Depends(get_db)) -> dict[str, Any]:
    item = load_event(db, event_id, lock=True)
    if item.status != "published" or as_utc(item.ends_at) <= datetime.now(UTC):
        raise HTTPException(409, "This event is not accepting RSVPs")
    existing = mine(db, event_id, identity, key)
    profile = require_profile(db, identity.user_id) if identity and not key else None
    email = str(payload.email).casefold()
    if profile and email != profile.email.casefold():
        raise HTTPException(400, "Use your GiveHub account email for this RSVP")
    duplicate = db.scalar(select(GatheringRSVP).where(GatheringRSVP.gathering_id == event_id, GatheringRSVP.email == email))
    if duplicate and (existing is None or duplicate.id != existing.id):
        raise HTTPException(409, "This email already has an RSVP. Use the original browser or your private edit link")
    if payload.plus_ones > item.data["max_plus_ones"]:
        raise HTTPException(400, "This event does not allow that many additional guests")
    for question in item.data["questions"]:
        if payload.choice != "declined" and question["required"] and not payload.answers.get(question["id"], "").strip():
            raise HTTPException(400, f"Please answer: {question['label']}")
    status: str = payload.choice
    if payload.choice == "going":
        if item.data["approval_required"] and (not existing or existing.status not in ("going", "waitlisted")):
            status = "pending"
        elif item.data["capacity"] is not None and seats(db, event_id, existing.id if existing else None) + 1 + payload.plus_ones > item.data["capacity"]:
            status = "waitlisted"
    previous_seats = 1 + existing.plus_ones if existing and existing.status == "going" else 0
    edit_key = secrets.token_urlsafe(32) if not existing else None
    guest = existing or GatheringRSVP(gathering_id=event_id, profile_id=profile.id if profile else None, edit_hash=key_hash(edit_key or ""))
    guest.name = payload.name.strip()
    if len(guest.name) < 2:
        raise HTTPException(400, "Enter your name")
    previous_email = guest.email if existing else ""
    guest.email = email
    guest.choice = payload.choice
    guest.status = status
    guest.plus_ones = payload.plus_ones if payload.choice == "going" else 0
    guest.answers = {q["id"]: payload.answers.get(q["id"], "").strip() for q in item.data["questions"]}
    guest.email_updates = payload.email_updates
    if profile:
        guest.email_verified = bool(identity and identity.email and identity.email.casefold() == email)
    elif email != previous_email:
        guest.email_verified = False
    guest.updated_at = datetime.now(UTC)
    db.add(guest)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "An RSVP already exists. Reload your invitation") from exc
    if previous_seats > (1 + guest.plus_ones if guest.status == "going" else 0):
        promote(db, item)
    schedule_reminders(db, item)
    db.commit()
    return {"rsvp": guest_out(guest), "edit_key": edit_key}


@router.get("/v1/organiser/community/events/{event_id}/guests")
def guests(event_id: uuid.UUID, identity: Identity = Depends(current_identity), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    load_event(db, event_id, host_id=host_profile(db, identity).id)
    return [guest_out(g) for g in db.scalars(select(GatheringRSVP).where(GatheringRSVP.gathering_id == event_id).order_by(GatheringRSVP.created_at)).all()]


@router.patch("/v1/organiser/community/events/{event_id}/guests/{guest_id}")
def decide_guest(event_id: uuid.UUID, guest_id: uuid.UUID, payload: GuestDecision, identity: Identity = Depends(current_identity), db: Session = Depends(get_db)) -> dict[str, Any]:
    item = load_event(db, event_id, host_id=host_profile(db, identity).id, lock=True)
    if item.status != "published":
        raise HTTPException(409, "Only published events accept guest decisions")
    guest = db.get(GatheringRSVP, guest_id)
    if not guest or guest.gathering_id != event_id:
        raise HTTPException(404, "Guest not found")
    if payload.status in ("going", "waitlisted") and guest.choice != "going":
        raise HTTPException(409, "This guest has not asked to attend")
    if payload.status == "going" and item.data["capacity"] is not None and seats(db, event_id, guest.id) + 1 + guest.plus_ones > item.data["capacity"]:
        raise HTTPException(409, "This guest has not asked to attend, or there are not enough open spots")
    guest.status = payload.status
    guest.updated_at = datetime.now(UTC)
    db.flush()
    queue(db, item, guest, kind="status", dedupe=f"decision:{uuid.uuid4()}", subject=f"RSVP update: {item.data['title']}", body=f"The host changed your RSVP to {guest.status}.")
    if guest.status == "declined":
        promote(db, item)
    schedule_reminders(db, item)
    db.commit()
    return guest_out(guest)


@router.get("/v1/organiser/community/events/{event_id}/guests.csv")
def guest_csv(event_id: uuid.UUID, identity: Identity = Depends(current_identity), db: Session = Depends(get_db)) -> Response:
    item = load_event(db, event_id, host_id=host_profile(db, identity).id)
    output = io.StringIO()
    writer = csv.writer(output)
    questions = item.data["questions"]
    writer.writerow(["Name", "Email", "Response", "Status", "Additional guests", *[q["label"] for q in questions]])
    for guest in db.scalars(select(GatheringRSVP).where(GatheringRSVP.gathering_id == event_id)).all():
        values = [guest.name, guest.email, guest.choice, guest.status, str(guest.plus_ones), *[guest.answers.get(q["id"], "") for q in questions]]
        writer.writerow([f"'{v}" if v.lstrip().startswith(("=", "+", "-", "@")) else v for v in values])
    return Response("\ufeff" + output.getvalue(), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="givehub-guests.csv"'})


@router.post("/v1/organiser/community/events/{event_id}/announcements", status_code=201)
def announce(event_id: uuid.UUID, payload: AnnouncementInput, identity: Identity = Depends(current_identity), db: Session = Depends(get_db)) -> dict[str, str]:
    item = load_event(db, event_id, host_id=host_profile(db, identity).id, lock=True)
    if item.status != "published" or len(payload.body.strip()) < 3:
        raise HTTPException(400, "Publish the event and write an update first")
    message = GatheringMessage(gathering_id=event_id, body=payload.body.strip(), created_at=datetime.now(UTC))
    db.add(message)
    db.flush()
    for guest in db.scalars(select(GatheringRSVP).where(GatheringRSVP.gathering_id == event_id, GatheringRSVP.status != "declined")).all():
        queue(db, item, guest, kind="announcement", dedupe=f"message:{message.id}", subject=f"An update: {item.data['title']}", body=message.body)
    db.commit()
    return {"status": "queued"}


def process_deliveries(db: Session, settings: Settings, event_id: uuid.UUID | None = None) -> int:
    query = select(GatheringDelivery).where(GatheringDelivery.state == "queued", GatheringDelivery.due_at <= datetime.now(UTC)).order_by(GatheringDelivery.due_at).limit(100)
    if event_id:
        query = query.where(GatheringDelivery.gathering_id == event_id)
    count = 0
    for delivery in db.scalars(query).all():
        claimed = db.execute(update(GatheringDelivery).where(GatheringDelivery.id == delivery.id, GatheringDelivery.state == "queued").values(state="sending"))
        db.commit()
        if not claimed.rowcount:  # type: ignore[attr-defined]
            continue
        guest = db.get(GatheringRSVP, delivery.rsvp_id)
        item = db.get(Gathering, delivery.gathering_id)
        if not guest or not item or not guest.email_updates or guest.choice == "declined" or (delivery.kind in ("announcement", "update") and guest.status == "declined") or (delivery.kind == "reminder" and (guest.status != "going" or item.status != "published")):
            delivery.state = "cancelled"
        elif not settings.resend_api_key or not guest.email_verified:
            delivery.state = "preview"
        else:
            sent = send_email(settings, recipient=guest.email, subject=delivery.subject, text=delivery.body)
            delivery.state = "sent" if sent else "failed"
            delivery.error = "" if sent else "Check provider delivery before retrying; acceptance may be uncertain."
        db.commit()
        count += 1
    return count


@router.get("/v1/organiser/community/events/{event_id}/deliveries")
def deliveries(event_id: uuid.UUID, identity: Identity = Depends(current_identity), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    load_event(db, event_id, host_id=host_profile(db, identity).id)
    return [{"id": d.id, "recipient": db.get(GatheringRSVP, d.rsvp_id).email, "subject": d.subject, "body": d.body, "state": d.state, "due_at": d.due_at, "error": d.error} for d in db.scalars(select(GatheringDelivery).where(GatheringDelivery.gathering_id == event_id).order_by(GatheringDelivery.due_at.desc())).all()]  # type: ignore[union-attr]


@router.post("/v1/organiser/community/events/{event_id}/deliveries/process")
def deliver_due(event_id: uuid.UUID, identity: Identity = Depends(current_identity), settings: Settings = Depends(get_settings), db: Session = Depends(get_db)) -> dict[str, int]:
    load_event(db, event_id, host_id=host_profile(db, identity).id)
    return {"processed": process_deliveries(db, settings, event_id)}


@router.post("/v1/organiser/community/covers", status_code=201)
def upload_cover(payload: CoverInput, identity: Identity = Depends(current_identity), settings: Settings = Depends(get_settings), db: Session = Depends(get_db)) -> dict[str, str]:
    host_profile(db, identity)
    match = re.fullmatch(r"data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)", payload.data)
    if not match:
        raise HTTPException(400, "Choose a JPG, PNG or WebP image")
    try:
        data = base64.b64decode(match[2], validate=True)
    except ValueError as exc:
        raise HTTPException(400, "Invalid image") from exc
    valid = data.startswith(b"\xff\xd8\xff") if match[1] == "jpeg" else data.startswith(b"\x89PNG\r\n\x1a\n") if match[1] == "png" else data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if not valid or len(data) > 3_000_000:
        raise HTTPException(400, "Choose a valid image under 3 MB")
    filename = f"{uuid.uuid4()}.{'jpg' if match[1] == 'jpeg' else match[1]}"
    directory = Path(settings.community_upload_dir)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / filename).write_bytes(data)
    return {"url": f"/v1/community/covers/{filename}"}


@router.get("/v1/community/covers/{filename}")
def cover(filename: str, settings: Settings = Depends(get_settings)) -> FileResponse:
    if not re.fullmatch(r"[a-f0-9-]+\.(jpg|png|webp)", filename):
        raise HTTPException(404, "Cover not found")
    path = Path(settings.community_upload_dir) / filename
    if not path.is_file():
        raise HTTPException(404, "Cover not found")
    return FileResponse(path, headers={"X-Content-Type-Options": "nosniff"})


@router.get("/v1/community/events/{event_id}/calendar")
def gathering_calendar(event_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    item = public_event(db, event_id, None)
    if item.status != "published":
        raise HTTPException(409, "Only published events can be added to a calendar")
    def escape(value: str) -> str:
        return value.replace("\\", "\\\\").replace("\r", "").replace("\n", r"\n").replace(",", r"\,").replace(";", r"\;")
    def stamp(value: datetime) -> str:
        return as_utc(value).astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")
    location = "Shared after RSVP" if item.data["address_after_rsvp"] else item.data["location"]
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GiveHub//Community//EN", "BEGIN:VEVENT", f"UID:{item.id}@givehub", f"DTSTAMP:{stamp(datetime.now(UTC))}", f"DTSTART:{stamp(item.starts_at)}", f"DTEND:{stamp(item.ends_at)}", f"SUMMARY:{escape(item.data['title'])}", f"DESCRIPTION:{escape(item.data['description'])}", f"LOCATION:{escape(location)}", "END:VEVENT", "END:VCALENDAR"]
    folded = []
    for line in lines:
        part = ""
        for char in line:
            if len((part + char).encode()) > 74:
                folded.append(part)
                part = " "
            part += char
        folded.append(part)
    return Response("\r\n".join(folded), media_type="text/calendar", headers={"Content-Disposition": 'attachment; filename="givehub-event.ics"'})


@router.get("/g/{event_id}", response_class=HTMLResponse)
def gathering_share(event_id: uuid.UUID, settings: Settings = Depends(get_settings), db: Session = Depends(get_db)) -> HTMLResponse:
    item = public_event(db, event_id, None)
    return HTMLResponse(_page(title=item.data["title"], description="You're invited. See the details and RSVP on GiveHub.", image_url="", deep_link=f"givehub://g/{event_id}", web_link=f"{settings.public_web_url.rstrip('/')}/g/{event_id}" if settings.public_web_url else "", heading=item.data["title"], body="This event has been cancelled." if item.status == "cancelled" else item.data["description"], meta_line=f"GiveHub community · {item.data['starts_local']} ({item.data['timezone']})"))
