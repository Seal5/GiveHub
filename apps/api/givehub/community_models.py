"""Community gatherings share GiveHub identity without becoming volunteer applications."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from givehub.database import Base
from givehub.models import TimestampMixin


class Gathering(TimestampMixin, Base):
    __tablename__ = "gatherings"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    host_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSON)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, default=1)


class GatheringRSVP(TimestampMixin, Base):
    __tablename__ = "gathering_rsvps"
    __table_args__ = (UniqueConstraint("gathering_id", "email"), UniqueConstraint("gathering_id", "profile_id"))
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    gathering_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gatherings.id"), index=True)
    profile_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(320))
    choice: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), index=True)
    plus_ones: Mapped[int] = mapped_column(Integer, default=0)
    answers: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    edit_hash: Mapped[str] = mapped_column(String(64), unique=True)
    email_updates: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)


class GatheringMessage(Base):
    __tablename__ = "gathering_messages"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    gathering_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gatherings.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class GatheringDelivery(Base):
    __tablename__ = "gathering_deliveries"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    gathering_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gatherings.id"), index=True)
    rsvp_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gathering_rsvps.id"), index=True)
    dedupe: Mapped[str] = mapped_column(String(240), unique=True)
    kind: Mapped[str] = mapped_column(String(24))
    subject: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    state: Mapped[str] = mapped_column(String(24), default="queued", index=True)
    error: Mapped[str] = mapped_column(Text, default="")
