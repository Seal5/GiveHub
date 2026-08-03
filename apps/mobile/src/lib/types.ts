export type Role = "volunteer" | "organiser";
export type ThemePreference = "system" | "light" | "dark";
export type PersonalizationPreferences = {
  onboarding_completed: boolean;
  preferred_cause_slugs: string[];
  preferred_availability: string[];
  preferred_recurrences: Array<"one_off" | "weekly" | "monthly">;
  max_time_commitment_minutes: number | null;
  accessible_only: boolean;
  age_group: "under_16" | "16_17" | "18_plus" | null;
  training_preference: "any" | "avoid" | "open";
  screening_preference: "any" | "avoid" | "open";
  transportation_preference: "any" | "transit" | "walk_bike" | "drive";
};
export type ApplicationStatus =
  | "received"
  | "under_review"
  | "confirmed"
  | "waitlisted"
  | "declined"
  | "withdrawn";
export type OpportunityEventType = "viewed" | "application_started" | "shared";
export type Analytics = {
  views: number;
  application_starts: number;
  applications_submitted: number;
  shares: number;
  view_to_application_rate: number;
};

export type AttendanceStatus = "expected" | "attended" | "no_show" | "excused";
export type AttendanceRow = {
  application_id: string;
  volunteer_name: string;
  volunteer_email: string;
  status: AttendanceStatus;
  hours: number;
  notes: string;
};
export type AttendanceSheet = {
  opportunity_id: string;
  opportunity_title: string;
  default_hours: number;
  expected: number;
  attended: number;
  no_show: number;
  total_hours: number;
  rows: AttendanceRow[];
};
export type Impact = {
  total_hours: number;
  events_attended: number;
  organisations_supported: number;
  upcoming_confirmed: number;
  hours_this_year: number;
  causes: { slug: string; name: string; events: number }[];
  recent: { opportunity_id: string; title: string; organisation_name: string; starts_at: string; hours: number }[];
};

export type Cause = { id: string; slug: string; name: string };
export type Waiver = { id: string; title: string; body: string; version: number };
export type WaiverAcceptanceInput = {
  waiver_document_id: string;
  agreed: boolean;
  signed_name: string;
  is_minor: boolean;
  guardian_name?: string;
  guardian_email?: string;
  guardian_relationship?: string;
};
export type WaiverAcceptance = {
  signed_name: string;
  is_minor: boolean;
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_relationship: string | null;
  accepted_at: string;
  waiver_version: number;
  waiver_title: string;
};
export type LocationPoint = {
  place_id?: string;
  label: string;
  address_line: string;
  locality: string;
  city: string;
  postcode: string | null;
  country_code: string;
  latitude: number;
  longitude: number;
};
export type Profile = PersonalizationPreferences & {
  id: string;
  role: Role;
  display_name: string;
  email: string;
  search_location_label: string | null;
  search_latitude: number | null;
  search_longitude: number | null;
  search_radius_km: number;
  theme: ThemePreference;
  organisation_name: string | null;
};
export type Opportunity = {
  id: string;
  title: string;
  description: string;
  impact_statement: string;
  tasks: string;
  meeting_point: string;
  starts_at: string;
  ends_at: string;
  recurrence: "one_off" | "weekly" | "monthly";
  effort: string;
  minimum_age: number;
  accessibility: string;
  is_accessible: boolean;
  eligibility_notes: string;
  time_commitment_minutes: number;
  training_required: boolean;
  training_commitment: string;
  screening_required: boolean;
  screening_steps: string;
  transportation_info: string;
  qualifications: string;
  safety_notes: string;
  capacity: number;
  requires_waiver: boolean;
  listing_source: string;
  listing_source_url: string | null;
  listing_verification_status: "verified" | "pending" | "unverified";
  source_updated_at: string | null;
  source_checked_at: string | null;
  application_mode: "internal" | "external";
  external_application_url: string | null;
  updated_at: string;
  confirmed_count: number;
  image_url: string | null;
  status: "draft" | "published" | "unpublished";
  version: number;
  organisation_name: string;
  location_label: string;
  address_line: string;
  locality: string;
  city: string;
  postcode: string | null;
  country_code: string;
  latitude: number;
  longitude: number;
  location_visibility: "public" | "approximate" | "confirmed_only";
  causes: Cause[];
  distance_km: number | null;
  is_saved: boolean;
};
export type Application = {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  volunteer_id: string;
  volunteer_name: string;
  volunteer_email: string;
  note: string;
  experience: string;
  availability: string;
  status: ApplicationStatus;
  version: number;
  next_step: string;
  history: { from_status: ApplicationStatus | null; to_status: ApplicationStatus; created_at: string }[];
  waiver: WaiverAcceptance | null;
};
export type NotificationPreferences = { notify_new_applications: boolean };
export type SourceCandidateDuplicate = {
  id: string;
  title: string;
  organisation_name: string;
  status: Opportunity["status"];
};
export type SourceCandidate = {
  id: string;
  source_name: string;
  source_url: string;
  title: string;
  organisation_name: string;
  location_label: string;
  summary: string;
  review_status: "pending" | "approved" | "rejected" | "out_of_area";
  first_seen_at: string;
  last_seen_at: string;
  reviewed_at: string | null;
  promoted_opportunity_id: string | null;
  duplicates: SourceCandidateDuplicate[];
};
export type ListingReportReason = "outdated" | "cancelled" | "broken_link" | "safety_accessibility" | "duplicate" | "spam" | "other";
export type ListingReport = {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  organisation_name: string;
  reporter_name: string;
  reason: ListingReportReason;
  details: string;
  status: "pending" | "dismissed" | "resolved";
  created_at: string;
  reviewed_at: string | null;
  resolution_note: string;
};
export type SourceRefreshRun = {
  id: string;
  trigger: string;
  status: "queued" | "running" | "succeeded" | "partial" | "failed";
  started_at: string | null;
  completed_at: string | null;
  discovered: number;
  candidates_added: number;
  candidates_updated: number;
  checked: number;
  expired: number;
  unavailable: number;
  skipped_protected: number;
  out_of_area: number;
  failed: number;
  error_summary: string;
};
export type SourceHealth = {
  schedule: string;
  next_scheduled_at: string;
  pending_candidates: number;
  stale_listings: number;
  refresh_in_progress: boolean;
  sources: { name: string; active_listings: number; pending_candidates: number; last_checked_at: string | null; last_seen_at: string | null }[];
  recent_runs: SourceRefreshRun[];
};
