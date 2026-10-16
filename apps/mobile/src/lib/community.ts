import { Platform, Share } from "react-native";
import * as SecureStore from "expo-secure-store";
import { demoMode, request, requestText } from "./api";

export type GatheringTheme = "citrus" | "rose" | "moss" | "midnight";
export type RSVPChoice = "going" | "maybe" | "declined";
export type RSVPStatus = RSVPChoice | "pending" | "waitlisted";
export type GuestQuestion = { id: string; label: string; required: boolean };
export type GatheringInput = {
  title: string; description: string; location: string; timezone: string;
  starts_local: string; ends_local: string; theme: GatheringTheme; cover_url: string;
  capacity: number | null; max_plus_ones: number; approval_required: boolean;
  guest_list_visible: boolean; address_after_rsvp: boolean; listed: boolean;
  reminder_enabled: boolean; questions: GuestQuestion[]; version?: number;
};
export type CommunityGuest = {
  id: string; name: string; email: string; choice: RSVPChoice; status: RSVPStatus;
  plus_ones: number; answers: Record<string, string>; email_updates: boolean; updated_at: string;
};
export type Gathering = GatheringInput & {
  id: string; status: "draft" | "published" | "cancelled"; host_name: string;
  starts_at: string; ends_at: string; version: number; going: number; responses: number;
  location_hidden: boolean; guests: { name: string; plus_ones: number }[];
  announcements: { id: string; body: string; created_at: string }[]; my_rsvp?: CommunityGuest | null;
};
export type RSVPInput = Pick<CommunityGuest, "name" | "email" | "choice" | "plus_ones" | "answers" | "email_updates">;
export type CommunityDelivery = { id: string; recipient: string; subject: string; body: string; state: string; due_at: string; error: string };
const root = "/v1/organiser/community/events";
const publicRoot = "/v1/community/events";
const encoded = encodeURIComponent;
const check = () => { if (demoMode) throw new Error("Community events use the connected GiveHub API. Open the connected preview to create events and RSVP."); };
export const community = {
  list: async (): Promise<Gathering[]> => { check(); return request(publicRoot); },
  mine: async (token: string | null): Promise<Gathering[]> => demoMode ? [] : request("/v1/community/my-rsvps", { token }),
  hosted: async (token: string | null): Promise<Gathering[]> => { check(); return request(root, { token }); },
  hostEvent: async (id: string, token: string | null): Promise<Gathering> => { check(); return request(`${root}/${encoded(id)}`, { token }); },
  event: async (id: string, token: string | null, key?: string | null): Promise<Gathering> => { check(); return request(`${publicRoot}/${encoded(id)}`, { token, headers: key ? { "X-GiveHub-RSVP-Key": key } : {} }); },
  save: async (input: GatheringInput, token: string | null, id?: string): Promise<Gathering> => { check(); return request(`${root}${id ? `/${encoded(id)}` : ""}`, { method: id ? "PUT" : "POST", token, body: JSON.stringify(input) }); },
  state: async (event: Gathering, status: Gathering["status"], token: string | null): Promise<Gathering> => request(`${root}/${encoded(event.id)}/status`, { method: "POST", token, body: JSON.stringify({ status, version: event.version }) }),
  rsvp: async (id: string, input: RSVPInput, token: string | null, key: string | null): Promise<{ rsvp: CommunityGuest; edit_key: string | null }> => request(`${publicRoot}/${encoded(id)}/rsvp`, { method: "POST", token, headers: key ? { "X-GiveHub-RSVP-Key": key } : {}, body: JSON.stringify(input) }),
  guests: (id: string, token: string | null): Promise<CommunityGuest[]> => request(`${root}/${encoded(id)}/guests`, { token }),
  decide: (id: string, guest: string, status: RSVPStatus, token: string | null) => request(`${root}/${encoded(id)}/guests/${encoded(guest)}`, { method: "PATCH", token, body: JSON.stringify({ status }) }),
  csv: (id: string, token: string | null) => requestText(`${root}/${encoded(id)}/guests.csv`, { token }),
  announce: (id: string, body: string, token: string | null) => request(`${root}/${encoded(id)}/announcements`, { method: "POST", token, body: JSON.stringify({ body }) }),
  deliveries: (id: string, token: string | null): Promise<CommunityDelivery[]> => request(`${root}/${encoded(id)}/deliveries`, { token }),
  process: (id: string, token: string | null) => request(`${root}/${encoded(id)}/deliveries/process`, { method: "POST", token }),
  upload: (data: string, token: string | null): Promise<{ url: string }> => request("/v1/organiser/community/covers", { method: "POST", token, body: JSON.stringify({ data }) }),
  calendar: (id: string) => requestText(`${publicRoot}/${encoded(id)}/calendar`),
};
export const coverUrl = (path: string) => path ? `${process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? ""}${path}` : undefined;
export const gatheringWebUrl = (id: string) => {
  const base = Platform.OS === "web" && typeof window !== "undefined" ? `${window.location.origin}${process.env.EXPO_PUBLIC_WEB_BASE_URL || ""}` : process.env.EXPO_PUBLIC_WEB_URL;
  return base ? `${base.replace(/\/$/, "")}/g/${encoded(id)}` : `givehub://g/${encoded(id)}`;
};
export const gatheringShareUrl = (id: string) => `${(process.env.EXPO_PUBLIC_SHARE_BASE_URL || process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "")}/g/${encoded(id)}`;
const keyName = (id: string) => `givehub.rsvp.${id}`;
const memory: Record<string, string> = {};
export async function readRsvpKey(id: string): Promise<string | null> {
  if (Platform.OS === "web") {
    const fragment = new URLSearchParams(window.location.hash.slice(1)).get("rsvp");
    if (fragment && /^[a-zA-Z0-9_-]{20,100}$/.test(fragment)) { await saveRsvpKey(id, fragment); window.history.replaceState(null, "", window.location.pathname + window.location.search); return fragment; }
    try { return localStorage.getItem(keyName(id)) ?? memory[id] ?? null; } catch { return memory[id] ?? null; }
  }
  try { return await SecureStore.getItemAsync(keyName(id)) ?? memory[id] ?? null; } catch { return memory[id] ?? null; }
}
export async function saveRsvpKey(id: string, value: string): Promise<void> {
  memory[id] = value;
  if (Platform.OS === "web") { try { localStorage.setItem(keyName(id), value); } catch { /* The private link still lets the guest return. */ } }
  else { try { await SecureStore.setItemAsync(keyName(id), value); } catch { /* The private edit link and in-memory key remain available. */ } }
}
export async function downloadCommunityFile(value: string, filename: string, type: string): Promise<void> {
  if (Platform.OS !== "web") { await Share.share({ title: filename, message: value }); return; }
  const url = URL.createObjectURL(new Blob([value], { type }));
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
export function communityDate(event: Pick<Gathering, "starts_at" | "timezone">): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: event.timezone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(event.starts_at));
}
