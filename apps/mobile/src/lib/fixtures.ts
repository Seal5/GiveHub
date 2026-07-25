import type { Application, Cause, Opportunity, Profile, Suburb } from "./types";

export const suburbs: Suburb[] = [
  { id: "te-aro", name: "Te Aro", city: "Wellington" },
  { id: "newtown", name: "Newtown", city: "Wellington" },
  { id: "karori", name: "Karori", city: "Wellington" },
];
export const causes: Cause[] = [
  { id: "cleanup", slug: "cleanup", name: "Cleanup" },
  { id: "planting", slug: "planting", name: "Planting" },
  { id: "monitoring", slug: "monitoring", name: "Monitoring" },
  { id: "community", slug: "community", name: "Community" },
];
const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
export const opportunities: Opportunity[] = [
  {
    id: "beach-clean",
    title: "Oriental Bay Beach Clean",
    description: "Spend a purposeful morning restoring the shoreline with a friendly local crew.",
    impact_statement: "Leave one of Wellington’s busiest beaches better than you found it.",
    tasks: "Collect litter, sort recyclables, and record the most common waste items.",
    meeting_point: "Freyberg Beach changing rooms",
    starts_at: future(5), ends_at: future(5), recurrence: "weekly", effort: "moderate",
    minimum_age: 14, accessibility: "Step-free meeting point; tasks can be adapted.",
    safety_notes: "Bring water, sun protection, and closed shoes.", capacity: 24, confirmed_count: 18,
    image_url: "https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=1200&q=85",
    status: "published", version: 1, organisation_name: "Kaitiaki Coastal Network",
    suburb: { id: "oriental-bay", name: "Oriental Bay", city: "Wellington" }, causes: [causes[0]!], distance_km: 1.1, is_saved: false,
  },
  {
    id: "garden-day", title: "Community Garden Planting Day",
    description: "Prepare garden beds and plant winter vegetables for the local food pantry.",
    impact_statement: "Grow fresh food that stays in the neighbourhood.",
    tasks: "Prepare soil, plant seedlings, mulch beds, and share morning tea.", meeting_point: "Carrara Park community garden gate",
    starts_at: future(8), ends_at: future(8), recurrence: "monthly", effort: "active", minimum_age: 12,
    accessibility: "Wide paths and seated planting tasks are available.", safety_notes: "Gloves and tools are provided.", capacity: 18, confirmed_count: 11,
    image_url: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1200&q=85",
    status: "published", version: 1, organisation_name: "Newtown Community Pantry", suburb: suburbs[1]!, causes: [causes[1]!], distance_km: 2.3, is_saved: true,
  },
  {
    id: "stream-watch", title: "Karori Stream Monitoring",
    description: "Measure stream health and identify freshwater species with trained coordinators.",
    impact_statement: "Build the evidence needed to protect an urban waterway.", tasks: "Take water readings, photograph sites, and log observations.",
    meeting_point: "Karori Park pavilion", starts_at: future(11), ends_at: future(11), recurrence: "monthly", effort: "light", minimum_age: 16,
    accessibility: "Some uneven stream-bank terrain.", safety_notes: "Wear sturdy waterproof footwear.", capacity: 12, confirmed_count: 7,
    image_url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85",
    status: "published", version: 1, organisation_name: "Waiora Wellington", suburb: suburbs[2]!, causes: [causes[2]!], distance_km: 4.6, is_saved: false,
  },
];
export const profileFor = (role: "volunteer" | "organiser"): Profile => ({
  id: role === "volunteer" ? "00000000-0000-4000-8000-000000000020" : "00000000-0000-4000-8000-000000000010",
  role, display_name: role === "volunteer" ? "Mia Thompson" : "Kaitiaki Coastal Network",
  email: `${role}@example.com`, suburb: suburbs[0]!, search_radius_km: 15, theme: "system",
  organisation_name: role === "organiser" ? "Kaitiaki Coastal Network" : null,
});
export const applications: Application[] = [
  { id: "application-1", opportunity_id: opportunities[0]!.id, opportunity_title: opportunities[0]!.title,
    volunteer_id: profileFor("volunteer").id, volunteer_name: "Mia Thompson", volunteer_email: "volunteer@example.com",
    note: "I care about the coast and can help for the full morning.", experience: "Two previous community cleanups.", availability: "Available for the full event",
    status: "received", version: 1, next_step: "Your application was received. The host will review it next.", history: [] },
];
