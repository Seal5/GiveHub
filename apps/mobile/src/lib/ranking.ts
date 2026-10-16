import type { Opportunity, Profile } from "./types";

function availability(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(new Date(value));
  const weekday = parts.find(p => p.type === "weekday")?.value;
  const hour = Number(parts.find(p => p.type === "hour")?.value);
  return `${weekday === "Sat" || weekday === "Sun" ? "weekend" : "weekday"}_${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}`;
}

function match(item: Opportunity, profile: Profile) {
  let score = 0;
  const reasons: string[] = [];
  if (profile.preferred_cause_slugs.some(s => item.causes.some(c => c.slug === s))) { score += 4; reasons.push("Matches your causes"); }
  if (profile.preferred_recurrences.includes(item.recurrence)) { score += 2; reasons.push("Matches your preferred frequency"); }
  if (profile.max_time_commitment_minutes !== null && item.time_commitment_minutes <= profile.max_time_commitment_minutes) { score += 2; reasons.push("Fits your preferred duration"); }
  if (profile.accessible_only) { score += item.is_accessible ? 2 : -4; if (item.is_accessible) reasons.push("Accessible listing"); }
  const age = profile.age_group === "under_16" ? 15 : profile.age_group === "16_17" ? 17 : null;
  if (age !== null) score += item.minimum_age <= age ? 2 : -4;
  if (profile.training_preference === "avoid") { score += item.training_required ? -2 : 1; if (!item.training_required) reasons.push("No required training"); }
  if (profile.training_preference === "open" && item.training_required) score += 1;
  if (profile.screening_preference === "avoid") { score += item.screening_required ? -2 : 1; if (!item.screening_required) reasons.push("No required screening"); }
  if (profile.screening_preference === "open" && item.screening_required) score += 1;
  if (profile.preferred_availability.includes(availability(item.starts_at))) { score += 3; reasons.push("Fits your usual availability"); }
  const transport = { transit: ["transit", "subway", "bus", "streetcar", "go station"], walk_bike: ["walk", "walking", "bike", "cycling", "bicycle"], drive: ["parking", "car", "drive"], any: [] };
  if (transport[profile.transportation_preference].some(term => item.transportation_info.toLowerCase().includes(term))) score += 1;
  return { score, reasons };
}

export function rankDemoOpportunities(items: Opportunity[], profile: Profile, personalized: boolean): Opportunity[] {
  const scores = new Map(items.map(item => [item.id, match(item, profile)]));
  const ordered = items.map(item => ({ ...item, match_reasons: personalized ? scores.get(item.id)!.reasons : [] })).sort((a, b) =>
    (personalized ? scores.get(b.id)!.score - scores.get(a.id)!.score : 0) || (a.distance_km ?? 0) - (b.distance_km ?? 0) || Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const first = Math.min(...ordered.map(i => Date.parse(i.starts_at)));
  const cohorts = new Map<string, Map<string, Opportunity[]>>();
  for (const item of ordered) {
    const key = `${personalized ? scores.get(item.id)!.score : 0}:${Math.floor((item.distance_km ?? 0) / 5)}:${Math.floor((Date.parse(item.starts_at) - first) / (7 * 86400000))}`;
    const hosts = cohorts.get(key) ?? new Map<string, Opportunity[]>();
    const host = item.organisation_name.toLowerCase();
    const queue = hosts.get(host) ?? []; queue.push(item); hosts.set(host, queue); cohorts.set(key, hosts);
  }
  const result: Opportunity[] = [];
  for (const hosts of cohorts.values()) {
    while (hosts.size) for (const [host, queue] of hosts) { result.push(queue.shift()!); if (!queue.length) hosts.delete(host); }
  }
  return result;
}
