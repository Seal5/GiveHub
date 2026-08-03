from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from givehub.models import (
    ApplicationStatus,
    AttendanceStatus,
    ListingReportStatus,
    OpportunityEventType,
    OpportunityStatus,
    Recurrence,
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
    onboarding_completed: bool = False
    preferred_cause_slugs: list[str] = Field(default_factory=list, max_length=10)
    preferred_availability: list[str] = Field(default_factory=list, max_length=6)
    preferred_recurrences: list[str] = Field(default_factory=list, max_length=3)
    max_time_commitment_minutes: int | None = Field(default=None, ge=30, le=10080)
    accessible_only: bool = False
    age_group: str | None = Field(default=None, pattern="^(under_16|16_17|18_plus)$")
    training_preference: str = Field(default="any", pattern="^(any|avoid|open)$")
    screening_preference: str = Field(default="any", pattern="^(any|avoid|open)$")
    transportation_preference: str = Field(
        default="any", pattern="^(any|transit|walk_bike|drive)$"
    )

    @model_validator(mode="after")
    def coordinates_are_complete(self) -> ProfileUpdate:
        if (self.search_latitude is None) != (self.search_longitude is None):
            raise ValueError("Latitude and longitude must be supplied together")
        if self.search_latitude is not None and not self.search_location_label:
            raise ValueError("A location label is required with coordinates")
        allowed_availability = {
            "weekday_morning",
            "weekday_afternoon",
            "weekday_evening",
            "weekend_morning",
            "weekend_afternoon",
            "weekend_evening",
        }
        if not set(self.preferred_availability).issubset(allowed_availability):
            raise ValueError("Choose a supported availability window")
        if not set(self.preferred_recurrences).issubset({"one_off", "weekly", "monthly"}):
            raise ValueError("Choose a supported frequency")
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
    onboarding_completed: bool
    preferred_cause_slugs: list[str]
    preferred_availability: list[str]
    preferred_recurrences: list[str]
    max_time_commitment_minutes: int | None
    accessible_only: bool
    age_group: str | None
    training_preference: str
    screening_preference: str
    transportation_preference: str
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
    city: str = Field(default="Toronto", min_length=2, max_length=120)
    postcode: str | None = Field(default=None, max_length=20)
    country_code: str = Field(default="CA", min_length=2, max_length=2)
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
    is_accessible: bool = True
    eligibility_notes: str = "Open to volunteers who meet the listed minimum age."
    time_commitment_minutes: int = Field(default=180, ge=15, le=10080)
    training_required: bool = False
    training_commitment: str = "No training required."
    screening_required: bool = False
    screening_steps: str = "No screening required."
    transportation_info: str = "Plan your own transport to the meeting point."
    qualifications: str = "No prior qualifications required."
    safety_notes: str = "Closed shoes and water recommended."
    capacity: int = Field(default=20, ge=1, le=10000)
    requires_waiver: bool = True
    listing_source: str = Field(default="GiveHub organiser", max_length=180)
    listing_source_url: str | None = Field(default=None, max_length=1000)
    listing_verification_status: str = Field(
        default="verified", pattern="^(verified|pending|unverified)$"
    )
    source_updated_at: datetime | None = None
    source_checked_at: datetime | None = None
    application_mode: str = Field(default="internal", pattern="^(internal|external)$")
    external_application_url: str | None = Field(default=None, max_length=1000)
    cause_ids: list[uuid.UUID] = Field(min_length=1)
    image_url: str | None = None

    @model_validator(mode="after")
    def validate_schedule(self) -> OpportunityBase:
        if self.ends_at <= self.starts_at:
            raise ValueError("End time must be after start time")
        if self.application_mode == "external" and not self.external_application_url:
            raise ValueError("An external application URL is required")
        if self.application_mode == "internal" and self.external_application_url:
            raise ValueError("External application URLs are only valid for external applications")
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
    is_accessible: bool | None = None
    eligibility_notes: str | None = None
    time_commitment_minutes: int | None = Field(default=None, ge=15, le=10080)
    training_required: bool | None = None
    training_commitment: str | None = None
    screening_required: bool | None = None
    screening_steps: str | None = None
    transportation_info: str | None = None
    qualifications: str | None = None
    safety_notes: str | None = None
    capacity: int | None = Field(default=None, ge=1, le=10000)
    requires_waiver: bool | None = None
    listing_source: str | None = Field(default=None, max_length=180)
    listing_source_url: str | None = Field(default=None, max_length=1000)
    listing_verification_status: str | None = Field(
        default=None, pattern="^(verified|pending|unverified)$"
    )
    source_updated_at: datetime | None = None
    source_checked_at: datetime | None = None
    application_mode: str | None = Field(default=None, pattern="^(internal|external)$")
    external_application_url: str | None = Field(default=None, max_length=1000)
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
    is_accessible: bool
    eligibility_notes: str
    time_commitment_minutes: int
    training_required: bool
    training_commitment: str
    screening_required: bool
    screening_steps: str
    transportation_info: str
    qualifications: str
    safety_notes: str
    capacity: int
    requires_waiver: bool = True
    listing_source: str
    listing_source_url: str | None
    listing_verification_status: str
    source_updated_at: datetime | None
    source_checked_at: datetime | None
    application_mode: str
    external_application_url: str | None
    updated_at: datetime
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


class SourceCandidateDuplicateOut(BaseModel):
    id: uuid.UUID
    title: str
    organisation_name: str
    status: OpportunityStatus


class SourceCandidateOut(ORMModel):
    id: uuid.UUID
    source_name: str
    source_url: str
    title: str
    organisation_name: str
    location_label: str
    summary: str
    review_status: str
    first_seen_at: datetime
    last_seen_at: datetime
    reviewed_at: datetime | None
    promoted_opportunity_id: uuid.UUID | None
    duplicates: list[SourceCandidateDuplicateOut] = Field(default_factory=list)


class SourceCandidateUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=4, max_length=180)
    organisation_name: str | None = Field(default=None, min_length=2, max_length=180)
    location_label: str | None = Field(default=None, min_length=2, max_length=240)
    summary: str | None = Field(default=None, max_length=4000)


class SourceCandidatePromote(BaseModel):
    allow_duplicate: bool = False


class ListingReportCreate(BaseModel):
    reason: str = Field(
        pattern="^(outdated|cancelled|broken_link|safety_accessibility|duplicate|spam|other)$"
    )
    details: str = Field(default="", max_length=2000)


class ListingReportModerate(BaseModel):
    action: str = Field(pattern="^(dismiss|resolve|unpublish)$")
    resolution_note: str = Field(default="", max_length=1000)


class ListingReportOut(ORMModel):
    id: uuid.UUID
    opportunity_id: uuid.UUID
    opportunity_title: str
    organisation_name: str
    reporter_name: str
    reason: str
    details: str
    status: ListingReportStatus
    created_at: datetime
    reviewed_at: datetime | None
    resolution_note: str


class SourceRefreshRunOut(ORMModel):
    id: uuid.UUID
    trigger: str
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    discovered: int
    candidates_added: int
    candidates_updated: int
    checked: int
    expired: int
    unavailable: int
    skipped_protected: int
    out_of_area: int
    failed: int
    error_summary: str


class SourceHealthSourceOut(BaseModel):
    name: str
    active_listings: int
    pending_candidates: int
    last_checked_at: datetime | None
    last_seen_at: datetime | None


class SourceHealthOut(BaseModel):
    schedule: str
    next_scheduled_at: datetime
    pending_candidates: int
    stale_listings: int
    refresh_in_progress: bool
    sources: list[SourceHealthSourceOut]
    recent_runs: list[SourceRefreshRunOut]


class WaiverOut(ORMModel):
    id: uuid.UUID
    title: str
    body: str
    version: int


class WaiverUpdate(BaseModel):
    title: str = Field(min_length=4, max_length=180)
    body: str = Field(min_length=40)


class WaiverAcceptanceIn(BaseModel):
    """Captured at the moment of applying; the version signed is pinned by id."""

    waiver_document_id: uuid.UUID
    agreed: bool
    signed_name: str = Field(min_length=2, max_length=120)
    is_minor: bool = False
    guardian_name: str | None = Field(default=None, max_length=120)
    guardian_email: EmailStr | None = None
    guardian_relationship: str | None = Field(default=None, max_length=80)

    @model_validator(mode="after")
    def validate_consent(self) -> WaiverAcceptanceIn:
        if not self.agreed:
            raise ValueError("The waiver must be accepted to apply")
        if self.is_minor and not (self.guardian_name and self.guardian_email):
            raise ValueError("A guardian name and email are required for volunteers under 18")
        return self


class WaiverAcceptanceOut(ORMModel):
    signed_name: str
    is_minor: bool
    guardian_name: str | None
    guardian_email: EmailStr | None
    guardian_relationship: str | None
    accepted_at: datetime
    waiver_version: int
    waiver_title: str


class ApplicationCreate(BaseModel):
    note: str = Field(min_length=10, max_length=2000)
    experience: str = Field(default="", max_length=2000)
    availability: str = Field(default="Available for the full event", max_length=240)
    waiver: WaiverAcceptanceIn | None = None


class ApplicationUpdate(BaseModel):
    note: str = Field(min_length=10, max_length=2000)
    experience: str = Field(default="", max_length=2000)
    availability: str = Field(default="Available for the full event", max_length=240)
    version: int = Field(ge=1)


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
    waiver: WaiverAcceptanceOut | None = None


class NotificationPreferencesOut(BaseModel):
    notify_new_applications: bool


class NotificationPreferencesUpdate(BaseModel):
    notify_new_applications: bool


class PipelineOut(BaseModel):
    counts: dict[ApplicationStatus, int]
    applications: list[ApplicationOut]


class OpportunityEventCreate(BaseModel):
    event_type: OpportunityEventType


class AnalyticsOut(BaseModel):
    views: int
    application_starts: int
    applications_submitted: int
    shares: int
    view_to_application_rate: float


class AttendanceUpdate(BaseModel):
    status: AttendanceStatus
    hours: float | None = Field(default=None, ge=0, le=24)
    notes: str = Field(default="", max_length=500)


class AttendanceRowOut(BaseModel):
    application_id: uuid.UUID
    volunteer_name: str
    volunteer_email: EmailStr
    status: AttendanceStatus
    hours: float
    notes: str


class AttendanceSheetOut(BaseModel):
    opportunity_id: uuid.UUID
    opportunity_title: str
    default_hours: float
    expected: int
    attended: int
    no_show: int
    total_hours: float
    rows: list[AttendanceRowOut]


class ImpactCauseOut(BaseModel):
    slug: str
    name: str
    events: int


class ImpactEventOut(BaseModel):
    opportunity_id: uuid.UUID
    title: str
    organisation_name: str
    starts_at: datetime
    hours: float


class ImpactOut(BaseModel):
    """A volunteer's own record of what they have actually contributed."""

    total_hours: float
    events_attended: int
    organisations_supported: int
    upcoming_confirmed: int
    hours_this_year: float
    causes: list[ImpactCauseOut]
    recent: list[ImpactEventOut]


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
    country_code: str = "CA"
    latitude: float
    longitude: float


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorEnvelope(BaseModel):
    error: ErrorDetail
