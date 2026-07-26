export type Role = "volunteer" | "organiser";
export type ThemePreference = "system" | "light" | "dark";
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

export type Cause = { id: string; slug: string; name: string };
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
export type Profile = {
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
  safety_notes: string;
  capacity: number;
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
};
