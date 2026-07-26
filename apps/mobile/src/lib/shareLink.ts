import { formatEventDate } from "./format";
import type { Opportunity } from "./types";

/**
 * Link building is kept free of react-native imports so it stays unit testable.
 * Shared links point at the API's public landing page, which renders an Open Graph
 * preview and deep links into the app. Override with EXPO_PUBLIC_SHARE_BASE_URL once
 * a marketing domain fronts the same route.
 */
// Uses `||` rather than `??` so a blank env var falls back instead of disabling sharing.
const shareBase = (process.env.EXPO_PUBLIC_SHARE_BASE_URL?.trim() || process.env.EXPO_PUBLIC_API_URL?.trim() || "").replace(/\/$/, "");

export type ShareableOpportunity = Pick<Opportunity, "id" | "title" | "organisation_name" | "starts_at" | "location_label">;

export const opportunityShareUrl = (id: string): string | null => (shareBase ? `${shareBase}/o/${id}` : null);

export function opportunityShareMessage(item: Omit<ShareableOpportunity, "id">): string {
  return [
    `${item.title} with ${item.organisation_name}`,
    `${formatEventDate(item.starts_at)} · ${item.location_label}`,
    "",
    "Join me on GiveHub:",
  ].join("\n");
}
