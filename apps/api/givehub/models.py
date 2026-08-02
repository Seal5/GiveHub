from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from givehub.database import Base


def now_utc() -> datetime:
    return datetime.now(UTC)


class Role(str, enum.Enum):
    volunteer = "volunteer"
    organiser = "organiser"


class VerificationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class OpportunityStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    unpublished = "unpublished"


class Recurrence(str, enum.Enum):
    one_off = "one_off"
    weekly = "weekly"
    monthly = "monthly"


class ApplicationStatus(str, enum.Enum):
    received = "received"
    under_review = "under_review"
    confirmed = "confirmed"
    waitlisted = "waitlisted"
    declined = "declined"
    withdrawn = "withdrawn"


class AttendanceStatus(str, enum.Enum):
    expected = "expected"
    attended = "attended"
    no_show = "no_show"
    excused = "excused"


class OpportunityEventType(str, enum.Enum):
    viewed = "viewed"
    application_started = "application_started"
    application_submitted = "application_submitted"
    shared = "shared"


opportunity_causes = Table(
    "opportunity_causes",
    Base.metadata,
    Column(
        "opportunity_id", Uuid, ForeignKey("opportunities.id", ondelete="CASCADE"), primary_key=True
    ),
    Column("cause_id", Uuid, ForeignKey("causes.id", ondelete="CASCADE"), primary_key=True),
)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )


class Profile(TimestampMixin, Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    role: Mapped[Role] = mapped_column(Enum(Role, native_enum=False), index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    suburb_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("suburbs.id"))
    search_location_label: Mapped[str | None] = mapped_column(String(240))
    search_latitude: Mapped[float | None] = mapped_column(Float)
    search_longitude: Mapped[float | None] = mapped_column(Float)
    search_radius_km: Mapped[int] = mapped_column(Integer, default=25)
    theme: Mapped[str] = mapped_column(String(16), default="system")

    suburb: Mapped[Suburb | None] = relationship()
    organisation: Mapped[Organisation | None] = relationship(back_populates="owner", uselist=False)


class Organisation(TimestampMixin, Base):
    __tablename__ = "organisations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id"), unique=True)
    name: Mapped[str] = mapped_column(String(180))
    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus, native_enum=False), default=VerificationStatus.approved
    )
    notify_new_applications: Mapped[bool] = mapped_column(Boolean, default=True)

    owner: Mapped[Profile] = relationship(back_populates="organisation")
    opportunities: Mapped[list[Opportunity]] = relationship(back_populates="organisation")


class Suburb(Base):
    __tablename__ = "suburbs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    city: Mapped[str] = mapped_column(String(100), default="Toronto")
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)


class Cause(Base):
    __tablename__ = "causes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))

    opportunities: Mapped[list[Opportunity]] = relationship(
        secondary=opportunity_causes, back_populates="causes"
    )


class Opportunity(TimestampMixin, Base):
    __tablename__ = "opportunities"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organisations.id"), index=True)
    suburb_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("suburbs.id"), index=True)
    title: Mapped[str] = mapped_column(String(180), index=True)
    description: Mapped[str] = mapped_column(Text)
    impact_statement: Mapped[str] = mapped_column(String(240))
    tasks: Mapped[str] = mapped_column(Text)
    meeting_point: Mapped[str] = mapped_column(String(240))
    location_label: Mapped[str] = mapped_column(String(240))
    address_line: Mapped[str] = mapped_column(String(240))
    locality: Mapped[str] = mapped_column(String(120), default="")
    city: Mapped[str] = mapped_column(String(120), default="Toronto")
    postcode: Mapped[str | None] = mapped_column(String(20))
    country_code: Mapped[str] = mapped_column(String(2), default="CA")
    latitude: Mapped[float] = mapped_column(Float, index=True)
    longitude: Mapped[float] = mapped_column(Float, index=True)
    location_visibility: Mapped[str] = mapped_column(String(24), default="public")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    recurrence: Mapped[Recurrence] = mapped_column(Enum(Recurrence, native_enum=False))
    effort: Mapped[str] = mapped_column(String(32), default="moderate")
    minimum_age: Mapped[int] = mapped_column(Integer, default=16)
    accessibility: Mapped[str] = mapped_column(
        Text, default="Contact the host to discuss access needs."
    )
    is_accessible: Mapped[bool] = mapped_column(Boolean, default=True)
    eligibility_notes: Mapped[str] = mapped_column(
        Text, default="Open to volunteers who meet the listed minimum age."
    )
    time_commitment_minutes: Mapped[int] = mapped_column(Integer, default=180)
    training_required: Mapped[bool] = mapped_column(Boolean, default=False)
    training_commitment: Mapped[str] = mapped_column(Text, default="No training required.")
    screening_required: Mapped[bool] = mapped_column(Boolean, default=False)
    screening_steps: Mapped[str] = mapped_column(Text, default="No screening required.")
    transportation_info: Mapped[str] = mapped_column(
        Text, default="Plan your own transport to the meeting point."
    )
    qualifications: Mapped[str] = mapped_column(Text, default="No prior qualifications required.")
    safety_notes: Mapped[str] = mapped_column(Text, default="Closed shoes and water recommended.")
    capacity: Mapped[int] = mapped_column(Integer, default=20)
    requires_waiver: Mapped[bool] = mapped_column(Boolean, default=True)
    listing_source: Mapped[str] = mapped_column(String(180), default="GiveHub organiser")
    listing_source_url: Mapped[str | None] = mapped_column(String(1000))
    listing_verification_status: Mapped[str] = mapped_column(String(24), default="verified")
    source_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    application_mode: Mapped[str] = mapped_column(String(16), default="internal")
    external_application_url: Mapped[str | None] = mapped_column(String(1000))
    image_url: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[OpportunityStatus] = mapped_column(
        Enum(OpportunityStatus, native_enum=False), default=OpportunityStatus.draft, index=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)

    organisation: Mapped[Organisation] = relationship(back_populates="opportunities")
    suburb: Mapped[Suburb | None] = relationship()
    causes: Mapped[list[Cause]] = relationship(
        secondary=opportunity_causes, back_populates="opportunities"
    )
    applications: Mapped[list[Application]] = relationship(back_populates="opportunity")
    events: Mapped[list[OpportunityEvent]] = relationship(
        back_populates="opportunity", cascade="all, delete-orphan"
    )


class SourceCandidate(TimestampMixin, Base):
    """A newly discovered external listing awaiting a human quality review."""

    __tablename__ = "source_candidates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    source_name: Mapped[str] = mapped_column(String(120), index=True)
    source_url: Mapped[str] = mapped_column(String(1000), unique=True)
    title: Mapped[str] = mapped_column(String(180), index=True)
    organisation_name: Mapped[str] = mapped_column(String(180))
    location_label: Mapped[str] = mapped_column(String(240), default="Greater Toronto Area")
    summary: Mapped[str] = mapped_column(Text, default="")
    review_status: Mapped[str] = mapped_column(String(24), default="pending", index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class SavedOpportunity(TimestampMixin, Base):
    __tablename__ = "saved_opportunities"
    __table_args__ = (UniqueConstraint("profile_id", "opportunity_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"))
    opportunity_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("opportunities.id", ondelete="CASCADE")
    )


class Application(TimestampMixin, Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("opportunity_id", "volunteer_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    opportunity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("opportunities.id"), index=True)
    volunteer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id"), index=True)
    note: Mapped[str] = mapped_column(Text)
    experience: Mapped[str] = mapped_column(Text, default="")
    availability: Mapped[str] = mapped_column(String(240), default="Available for the full event")
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, native_enum=False), default=ApplicationStatus.received, index=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)

    opportunity: Mapped[Opportunity] = relationship(back_populates="applications")
    volunteer: Mapped[Profile] = relationship()
    history: Mapped[list[ApplicationStatusHistory]] = relationship(
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="ApplicationStatusHistory.created_at",
    )
    waiver_acceptance: Mapped[WaiverAcceptance | None] = relationship(
        back_populates="application", cascade="all, delete-orphan", uselist=False
    )
    attendance: Mapped[Attendance | None] = relationship(
        back_populates="application", cascade="all, delete-orphan", uselist=False
    )


class ApplicationStatusHistory(Base):
    __tablename__ = "application_status_history"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    from_status: Mapped[ApplicationStatus | None] = mapped_column(
        Enum(ApplicationStatus, native_enum=False), nullable=True
    )
    to_status: Mapped[ApplicationStatus] = mapped_column(Enum(ApplicationStatus, native_enum=False))
    changed_by: Mapped[uuid.UUID] = mapped_column(Uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    application: Mapped[Application] = relationship(back_populates="history")


class Attendance(TimestampMixin, Base):
    """Whether a confirmed volunteer actually turned up, and for how long.

    Hours are recorded per attendance rather than derived from the event window so
    an organiser can log the time someone genuinely gave.
    """

    __tablename__ = "attendance_records"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), unique=True, index=True
    )
    status: Mapped[AttendanceStatus] = mapped_column(
        Enum(AttendanceStatus, native_enum=False), default=AttendanceStatus.expected, index=True
    )
    hours: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str] = mapped_column(Text, default="")
    recorded_by: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    recorded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    application: Mapped[Application] = relationship(back_populates="attendance")


class WaiverDocument(TimestampMixin, Base):
    """A versioned, immutable waiver. Editing publishes a new row rather than
    mutating this one, so an acceptance always points at the exact wording signed."""

    __tablename__ = "waiver_documents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # NULL marks the GiveHub-wide default used by organisations without their own.
    organisation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(180))
    body: Mapped[str] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    organisation: Mapped[Organisation | None] = relationship()


class WaiverAcceptance(Base):
    """Evidence that a volunteer agreed to a specific waiver version."""

    __tablename__ = "waiver_acceptances"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), unique=True, index=True
    )
    waiver_document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("waiver_documents.id"), index=True
    )
    signed_name: Mapped[str] = mapped_column(String(120))
    is_minor: Mapped[bool] = mapped_column(Boolean, default=False)
    guardian_name: Mapped[str | None] = mapped_column(String(120))
    guardian_email: Mapped[str | None] = mapped_column(String(320))
    guardian_relationship: Mapped[str | None] = mapped_column(String(80))
    signed_ip: Mapped[str | None] = mapped_column(String(45))
    accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    application: Mapped[Application] = relationship(back_populates="waiver_acceptance")
    waiver_document: Mapped[WaiverDocument] = relationship()


class OpportunityEvent(Base):
    __tablename__ = "opportunity_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    opportunity_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("opportunities.id", ondelete="CASCADE"), index=True
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    event_type: Mapped[OpportunityEventType] = mapped_column(
        Enum(OpportunityEventType, native_enum=False), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, index=True
    )

    opportunity: Mapped[Opportunity] = relationship(back_populates="events")
    profile: Mapped[Profile] = relationship()
