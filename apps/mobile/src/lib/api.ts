import { applications, causes, demoLocations, opportunities, profileFor } from "./fixtures";
import type {
  Analytics,
  Application,
  ApplicationStatus,
  LocationPoint,
  Opportunity,
  OpportunityEventType,
  Profile,
  Role,
  ThemePreference,
} from "./types";

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
const demoSetting = process.env.EXPO_PUBLIC_DEMO_MODE?.trim().toLowerCase();
const localAuthSetting = process.env.EXPO_PUBLIC_LOCAL_AUTH?.trim().toLowerCase();

export const demoMode = demoSetting === "true";
export const localAuthMode = !demoMode && localAuthSetting === "true";
export const apiConfigured = Boolean(apiUrl);
export const apiConfigurationError = !demoMode && !apiConfigured
  ? "Connected mode is enabled, but EXPO_PUBLIC_API_URL is missing. Create apps/mobile/.env, then restart Expo with --clear."
  : demoSetting && demoSetting !== "true" && demoSetting !== "false"
    ? "EXPO_PUBLIC_DEMO_MODE must be either true or false."
    : localAuthSetting && localAuthSetting !== "true" && localAuthSetting !== "false"
      ? "EXPO_PUBLIC_LOCAL_AUTH must be either true or false."
    : null;
let demoApplications = [...applications];
let demoOpportunities = [...opportunities];
const demoAnalytics: Analytics = {
  views: 48,
  application_starts: 14,
  applications_submitted: applications.length,
  shares: 7,
  view_to_application_rate: Math.round((applications.length / 48) * 1000) / 10,
};
const demoProfiles: Record<Role, Profile> = { volunteer: profileFor("volunteer"), organiser: profileFor("organiser") };

type Options = RequestInit & { token?: string | null };

const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1); const dLng = radians(lng2 - lng1);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

async function request<T>(path: string, options: Options = {}): Promise<T> {
  if (apiConfigurationError) throw new Error(apiConfigurationError);
  if (!apiUrl) throw new Error("GiveHub API is not configured.");
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "GiveHub could not complete that request");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function requestText(path: string, options: Options = {}): Promise<string> {
  if (apiConfigurationError) throw new Error(apiConfigurationError);
  if (!apiUrl) throw new Error("GiveHub API is not configured.");
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "GiveHub could not complete that request");
  }
  return response.text();
}

const queryString = (values: Record<string, string | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => value && query.set(key, value));
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
};

export const api = {
  profile: async (role: Role, token?: string | null): Promise<Profile> =>
    demoMode ? demoProfiles[role] : request("/v1/profiles/me", { token }),
  createProfile: async (
    input: { role: Role; display_name: string; email: string; organisation_name?: string },
    token?: string | null,
  ): Promise<Profile> =>
    demoMode
      ? (demoProfiles[input.role] = { ...profileFor(input.role), display_name: input.display_name, email: input.email, organisation_name: input.organisation_name ?? null })
      : request("/v1/profiles", { method: "POST", body: JSON.stringify(input), token }),
  causes: async () => (demoMode ? causes : request<typeof causes>("/v1/reference/causes")),
  locationSuggestions: async (q: string, token?: string | null): Promise<{ place_id: string; label: string }[]> =>
    demoMode
      ? demoLocations.filter((item) => item.label.toLowerCase().includes(q.toLowerCase())).map(({ place_id, label }) => ({ place_id: place_id!, label }))
      : request(`/v1/locations/autocomplete?q=${encodeURIComponent(q)}`, { token }),
  resolveLocation: async (placeId: string, token?: string | null): Promise<LocationPoint> => {
    if (demoMode) {
      const found = demoLocations.find((item) => item.place_id === placeId);
      if (!found) throw new Error("Location not found");
      return found;
    }
    return request(`/v1/locations/places/${encodeURIComponent(placeId)}`, { token });
  },
  opportunities: async (
    filters: { q?: string; cause?: string; recurrence?: string; saved?: boolean; lat?: number; lng?: number; radius_km?: number } = {},
    token?: string | null,
  ): Promise<Opportunity[]> => {
    if (demoMode) {
      const query = filters.q?.toLowerCase();
      const profile = demoProfiles.volunteer;
      const lat = filters.lat ?? profile.search_latitude; const lng = filters.lng ?? profile.search_longitude;
      const radius = filters.radius_km ?? profile.search_radius_km;
      return demoOpportunities.map((item) => ({ ...item, distance_km: lat !== null && lng !== null ? distanceKm(lat, lng, item.latitude, item.longitude) : null })).filter((item) =>
        (!query || [item.title, item.organisation_name, item.description, item.tasks, item.location_label].join(" ").toLowerCase().includes(query)) &&
        (!filters.cause || item.causes.some((cause) => cause.slug === filters.cause)) &&
        (!filters.recurrence || item.recurrence === filters.recurrence) &&
        (!filters.saved || item.is_saved) &&
        (item.distance_km === null || item.distance_km <= radius)
      ).sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
    }
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value !== undefined && value !== "" && query.set(key, String(value)));
    return request(`/v1/opportunities?${query}`, { token });
  },
  opportunity: async (id: string, token?: string | null): Promise<Opportunity> => {
    if (demoMode) {
      const found = demoOpportunities.find((item) => item.id === id);
      if (!found) throw new Error("Opportunity not found");
      return found;
    }
    return request(`/v1/opportunities/${id}`, { token });
  },
  trackOpportunityEvent: async (
    id: string,
    eventType: OpportunityEventType,
    token?: string | null,
  ): Promise<void> => {
    if (demoMode) {
      if (eventType === "viewed") demoAnalytics.views += 1;
      if (eventType === "application_started") demoAnalytics.application_starts += 1;
      if (eventType === "shared") demoAnalytics.shares += 1;
      demoAnalytics.view_to_application_rate = demoAnalytics.views
        ? Math.round((demoAnalytics.applications_submitted / demoAnalytics.views) * 1000) / 10
        : 0;
      return;
    }
    return request(`/v1/opportunities/${id}/events`, {
      method: "POST",
      body: JSON.stringify({ event_type: eventType }),
      token,
    });
  },
  setSaved: async (id: string, saved: boolean, token?: string | null): Promise<void> => {
    if (demoMode) {
      demoOpportunities = demoOpportunities.map((item) => item.id === id ? { ...item, is_saved: saved } : item);
      return;
    }
    return request(`/v1/opportunities/${id}/saved`, { method: saved ? "PUT" : "DELETE", token });
  },
  apply: async (
    id: string,
    input: { note: string; experience: string; availability: string },
    token?: string | null,
  ): Promise<Application> => {
    if (demoMode) {
      const event = demoOpportunities.find((item) => item.id === id)!;
      const application: Application = {
        id: `application-${Date.now()}`, opportunity_id: id, opportunity_title: event.title,
        volunteer_id: profileFor("volunteer").id, volunteer_name: "Mia Thompson", volunteer_email: "volunteer@example.com",
        ...input, status: "received", version: 1,
        next_step: "Your application was received. The host will review it next.", history: [],
      };
      demoApplications = [application, ...demoApplications.filter((item) => item.opportunity_id !== id)];
      demoAnalytics.applications_submitted += 1;
      demoAnalytics.view_to_application_rate = demoAnalytics.views
        ? Math.round((demoAnalytics.applications_submitted / demoAnalytics.views) * 1000) / 10
        : 0;
      return application;
    }
    return request(`/v1/opportunities/${id}/applications`, { method: "POST", body: JSON.stringify(input), token });
  },
  myApplications: async (token?: string | null): Promise<Application[]> =>
    demoMode ? demoApplications : request("/v1/applications/me", { token }),
  organiserOpportunities: async (token?: string | null): Promise<Opportunity[]> =>
    demoMode ? demoOpportunities : request("/v1/organiser/opportunities", { token }),
  organiserAnalytics: async (token?: string | null): Promise<Analytics> =>
    demoMode ? { ...demoAnalytics } : request("/v1/organiser/analytics", { token }),
  createOpportunity: async (input: Record<string, unknown>, token?: string | null): Promise<Opportunity> => {
    if (demoMode) {
      const created: Opportunity = {
        ...opportunities[0]!, ...input, id: `opportunity-${Date.now()}`, status: "draft", version: 1,
        organisation_name: "Kaitiaki Coastal Network", causes: [causes[3]!],
        location_label: String(input.location_label ?? "Wellington Central, Wellington"), address_line: String(input.address_line ?? "Wellington Central"), locality: String(input.locality ?? "Wellington Central"), city: String(input.city ?? "Wellington"), postcode: (input.postcode as string | null) ?? null, country_code: "NZ", latitude: Number(input.latitude ?? -41.2866), longitude: Number(input.longitude ?? 174.7756), location_visibility: "public",
        confirmed_count: 0, distance_km: 0, is_saved: false,
      } as Opportunity;
      demoOpportunities = [created, ...demoOpportunities];
      return created;
    }
    return request("/v1/organiser/opportunities", { method: "POST", body: JSON.stringify(input), token });
  },
  publishOpportunity: async (id: string, token?: string | null): Promise<Opportunity> => {
    if (demoMode) {
      const found = demoOpportunities.find((item) => item.id === id)!;
      const updated = { ...found, status: "published" as const, version: found.version + 1 };
      demoOpportunities = demoOpportunities.map((item) => item.id === id ? updated : item);
      return updated;
    }
    return request(`/v1/organiser/opportunities/${id}/publish`, { method: "POST", token });
  },
  updateOpportunity: async (id: string, input: Record<string, unknown>, token?: string | null): Promise<Opportunity> => {
    if (demoMode) {
      const found = demoOpportunities.find((item) => item.id === id)!;
      const updated = { ...found, ...input, version: found.version + 1 } as Opportunity;
      demoOpportunities = demoOpportunities.map((item) => item.id === id ? updated : item);
      return updated;
    }
    return request(`/v1/organiser/opportunities/${id}`, { method: "PATCH", body: JSON.stringify(input), token });
  },
  imageUpload: async (id: string, input: { filename: string; content_type: string; size_bytes: number }, token?: string | null): Promise<{ path: string; token: string; public_url: string }> =>
    request(`/v1/organiser/opportunities/${id}/image-upload`, { method: "POST", body: JSON.stringify(input), token }),
  pipeline: async (
    id: string,
    token?: string | null,
    filters: { stage?: ApplicationStatus; q?: string; availability?: string } = {},
  ): Promise<{ counts: Record<ApplicationStatus, number>; applications: Application[] }> => {
    if (demoMode) {
      const counts = { received: 0, under_review: 0, confirmed: 0, waitlisted: 0, declined: 0, withdrawn: 0 } as Record<ApplicationStatus, number>;
      demoApplications.forEach((item) => { counts[item.status] += 1; });
      const q = filters.q?.toLowerCase();
      return {
        counts,
        applications: demoApplications.filter((item) =>
          item.opportunity_id === id &&
          (!filters.stage || item.status === filters.stage) &&
          (!filters.availability || item.availability.toLowerCase().includes(filters.availability.toLowerCase())) &&
          (!q || [item.volunteer_name, item.volunteer_email, item.note, item.experience, item.availability].join(" ").toLowerCase().includes(q))
        ),
      };
    }
    return request(`/v1/organiser/opportunities/${id}/pipeline${queryString(filters)}`, { token });
  },
  opportunityAnalytics: async (id: string, token?: string | null): Promise<Analytics> =>
    demoMode ? { ...demoAnalytics } : request(`/v1/organiser/opportunities/${id}/analytics`, { token }),
  exportApplications: async (
    id: string,
    filters: { stage?: ApplicationStatus; q?: string; availability?: string },
    token?: string | null,
  ): Promise<string> => {
    if (demoMode) {
      const result = await api.pipeline(id, token, filters);
      const escape = (value: string) => `"${value.replaceAll("\"", "\"\"")}"`;
      return [
        "Name,Email,Status,Availability,Experience,Application note",
        ...result.applications.map((item) =>
          [item.volunteer_name, item.volunteer_email, item.status, item.availability, item.experience, item.note].map(escape).join(",")
        ),
      ].join("\n");
    }
    return requestText(
      `/v1/organiser/opportunities/${id}/applications.csv${queryString(filters)}`,
      { token },
    );
  },
  transition: async (id: string, status: ApplicationStatus, version: number, token?: string | null): Promise<Application> => {
    if (demoMode) {
      const item = demoApplications.find((candidate) => candidate.id === id)!;
      const updated = { ...item, status, version: version + 1, next_step: status === "confirmed" ? "You’re in. Review the meeting point and event details." : `Your application is now ${status.replace("_", " ")}.` };
      demoApplications = demoApplications.map((candidate) => candidate.id === id ? updated : candidate);
      return updated;
    }
    return request(`/v1/organiser/applications/${id}`, { method: "PATCH", body: JSON.stringify({ status, version }), token });
  },
  updatePreferences: async (input: { search_location_label: string | null; search_latitude: number | null; search_longitude: number | null; search_radius_km: number; theme: ThemePreference }, token?: string | null): Promise<Profile> =>
    demoMode ? (demoProfiles.volunteer = { ...demoProfiles.volunteer, ...input }) : request("/v1/profiles/me/preferences", { method: "PUT", body: JSON.stringify(input), token }),
};
