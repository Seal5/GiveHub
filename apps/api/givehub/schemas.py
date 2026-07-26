from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from givehub.models import (
    ApplicationStatus,
    OpportunityEventType,
    OpportunityStatus,
    Recurrence,
    ReportReason,
    ReportStatus,
    Role,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SuburbOut(ORMModel):
    id: uuid.UUID
    name: str
    city: str


class CauseOut(ORMModel):
    id: uuid.UUID
    slug: str
    name: str


class ProfileCreate(BaseModel):
    role: Role
    display_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    organisation_name: str | None = Field(default=None, min_length=2, max_length=180)

    @model_validator(mode="after")
    def require_organisation(self) -> ProfileCreate:
        if self.role == Role.organiser and not self.organisation_name:
            raise ValueError("Organisation name is required for organisers")
        return self


class ProfileUpdate(BaseModel):
    search_location_label: str | None = Field(default=None, max_length=240)
    search_latitude: float | None = Field(default=None, ge=-90, le=90)
    search_longitude: float | None = Field(default=None, ge=-180, le=180)
    search_radius_km: int = Field(default=25, ge=1, le=100)
    theme: str = Field(default="system", pattern="^(system|light|dark)$")

    @model_validator(mode="after")
    def coordinates_are_complete(self) -> ProfileUpdate:
        if (self.search_latitude is None) != (self.search_longitude is None):
            raise ValueError("Latitude and longitude must be supplied together")
        if self.search_latitude is not None and not self.search_location_label:
            raise ValueError("A location label is required with coordinates")
        return self


class ProfileOut(ORMModel):
    id: uuid.UUID
    role: Role
    display_name: str
    email: EmailStr
    search_location_label: str | None
    search_latitude: float | None
    search_longitude: float | None
    search_radius_km: int
    theme: str
    organisation_name: str | None = None


class OpportunityBase(BaseModel):
    title: str = Field(min_length=4, max_length=180)
    description: str = Field(min_length=20)
    impact_statement: str = Field(min_length=8, max_length=240)
    tasks: str = Field(min_length=5)
    meeting_point: str = Field(min_length=4, max_length=240)
    location_label: str = Field(min_length=2, max_length=240)
    address_line: str = Field(min_length=2, max_length=240)
    locality: str = Field(default="", max_length=120)
    city: str = Field(default="Wellington", min_length=2, max_length=120)
    postcode: str | None = Field(default=None, max_length=20)
    country_code: str = Field(default="NZ", min_length=2, max_length=2)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    location_visibility: str = Field(
        default="public", pattern="^(public|approximate|confirmed_only)$"
    )
    starts_at: datetime
    ends_at: datetime
    recurrence: Recurrence = Recurrence.one_off
    effort: str = Field(default="moderate", pattern="^(light|moderate|active)$")
    minimum_age: int = Field(default=16, ge=0, le=100)
    accessibility: str = "Contact the host to discuss access needs."
    safety_notes: str = "Closed shoes and water recommended."
    capacity: int = Field(default=20, ge=1, le=10000)
    cause_ids: list[uuid.UUID] = Field(min_length=1)
    image_url: str | None = None

    @model_validator(mode="after")
    def validate_schedule(self) -> OpportunityBase:
        if self.ends_at <= self.starts_at:
            raise ValueError("End time must be after start time")
        return self


class OpportunityCreate(OpportunityBase):
    pass


class OpportunityUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=4, max_length=180)
    description: str | None = Field(default=None, min_length=20)
    impact_statement: str | None = Field(default=None, min_length=8, max_length=240)
    tasks: str | None = None
    meeting_point: str | None = None
    location_label: str | None = Field(default=None, min_length=2, max_length=240)
    address_line: str | None = Field(default=None, min_length=2, max_length=240)
    locality: str | None = Field(default=None, max_length=120)
    city: str | None = Field(default=None, min_length=2, max_length=120)
    postcode: str | None = Field(default=None, max_length=20)
    country_code: str | None = Field(default=None, min_length=2, max_length=2)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    location_visibility: str | None = Field(
        default=None, pattern="^(public|approximate|confirmed_only)$"
    )
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    recurrence: Recurrence | None = None
    effort: str | None = None
    minimum_age: int | None = Field(default=None, ge=0, le=100)
    accessibility: str | None = None
    safety_notes: str | None = None
    capacity: int | None = Field(default=None, ge=1, le=10000)
    cause_ids: list[uuid.UUID] | None = None
    image_url: str | None = None
    version: int = Field(ge=1)


class OpportunityOut(ORMModel):
    id: uuid.UUID
    title: str
    description: str
    impact_statement: str
    tasks: str
    meeting_point: str
    starts_at: datetime
    ends_at: datetime
    recurrence: Recurrence
    effort: str
    minimum_age: int
    accessibility: str
    safety_notes: str
    capacity: int
    confirmed_count: int = 0
    image_url: str | None
    status: OpportunityStatus
    version: int
    organisation_name: str
    location_label: str
    address_line: str
    locality: str
    city: str
    postcode: str | None
    country_code: str
    latitude: float
    longitude: float
    location_visibility: str
    causes: list[CauseOut]
    distance_km: float | None = None
    is_saved: bool = False


class ApplicationCreate(BaseModel):
    note: str = Field(min_length=10, max_length=2000)
    experience: str = Field(default="", max_length=2000)
    availability: str = Field(default="Available for the full event", max_length=240)


class ApplicationTransition(BaseModel):
    status: ApplicationStatus
    version: int = Field(ge=1)


class StatusHistoryOut(ORMModel):
    from_status: ApplicationStatus | None
    to_status: ApplicationStatus
    created_at: datetime


class ApplicationOut(ORMModel):
    id: uuid.UUID
    opportunity_id: uuid.UUID
    opportunity_title: str
    volunteer_id: uuid.UUID
    volunteer_name: str
    volunteer_email: EmailStr
    note: str
    experience: str
    availability: str
    status: ApplicationStatus
    version: int
    next_step: str
    history: list[StatusHistoryOut]


class PipelineOut(BaseModel):
    counts: dict[ApplicationStatus, int]
    applications: list[ApplicationOut]


class OpportunityEventCreate(BaseModel):
    event_type: OpportunityEventType


class OpportunityReportCreate(BaseModel):
    reason: ReportReason
    details: str = Field(default="", max_length=1000)


class OpportunityReportOut(ORMModel):
    id: uuid.UUID
    opportunity_id: uuid.UUID
    reason: ReportReason
    details: str
    status: ReportStatus
    created_at: datetime


class AnalyticsOut(BaseModel):
    views: int
    application_starts: int
    applications_submitted: int
    shares: int
    view_to_application_rate: float


class UploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=180)
    content_type: str = Field(pattern="^image/(jpeg|png|webp)$")
    size_bytes: int = Field(gt=0, le=10_000_000)


class UploadOut(BaseModel):
    path: str
    token: str
    public_url: str


class LocationSuggestion(BaseModel):
    place_id: str
    label: str


class LocationResult(BaseModel):
    place_id: str
    label: str
    address_line: str
    locality: str = ""
    city: str = ""
    postcode: str | None = None
    country_code: str = "NZ"
    latitude: float
    longitude: float


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorEnvelope(BaseModel):
    error: ErrorDetail
