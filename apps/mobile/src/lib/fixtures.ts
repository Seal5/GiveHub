import type { Application, Cause, LocationPoint, Opportunity, Profile } from "./types";

export const demoLocations: LocationPoint[] = [
  { place_id: "wellington-central", label: "Wellington Central, Wellington", address_line: "Wellington Central", locality: "Wellington Central", city: "Wellington", postcode: "6011", country_code: "NZ", latitude: -41.2866, longitude: 174.7756 },
  { place_id: "newtown", label: "Newtown, Wellington", address_line: "Newtown", locality: "Newtown", city: "Wellington", postcode: "6021", country_code: "NZ", latitude: -41.3102, longitude: 174.7793 },
  { place_id: "karori", label: "Karori, Wellington", address_line: "Karori", locality: "Karori", city: "Wellington", postcode: "6012", country_code: "NZ", latitude: -41.2841, longitude: 174.7361 },
  { place_id: "lower-hutt", label: "Lower Hutt, Wellington Region", address_line: "Lower Hutt", locality: "Lower Hutt", city: "Wellington Region", postcode: "5010", country_code: "NZ", latitude: -41.2092, longitude: 174.9081 },
  { place_id: "porirua", label: "Porirua, Wellington Region", address_line: "Porirua", locality: "Porirua", city: "Wellington Region", postcode: "5022", country_code: "NZ", latitude: -41.1347, longitude: 174.8393 },
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
    location_label: "Oriental Bay, Wellington", address_line: "139 Oriental Parade", locality: "Oriental Bay", city: "Wellington", postcode: "6011", country_code: "NZ", latitude: -41.2911, longitude: 174.7945, location_visibility: "public",
    causes: [causes[0]!], distance_km: 1.7, is_saved: false,
  },
  {
    id: "garden-day", title: "Community Garden Planting Day",
    description: "Prepare garden beds and plant winter vegetables for the local food pantry.",
    impact_statement: "Grow fresh food that stays in the neighbourhood.",
    tasks: "Prepare soil, plant seedlings, mulch beds, and share morning tea.", meeting_point: "Carrara Park community garden gate",
    starts_at: future(8), ends_at: future(8), recurrence: "monthly", effort: "active", minimum_age: 12,
    accessibility: "Wide paths and seated planting tasks are available.", safety_notes: "Gloves and tools are provided.", capacity: 18, confirmed_count: 11,
    image_url: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1200&q=85",
    status: "published", version: 1, organisation_name: "Newtown Community Pantry",
    location_label: "Newtown, Wellington", address_line: "Carrara Park", locality: "Newtown", city: "Wellington", postcode: "6021", country_code: "NZ", latitude: -41.3102, longitude: 174.7793, location_visibility: "public",
    causes: [causes[1]!], distance_km: 2.7, is_saved: true,
  },
  {
    id: "stream-watch", title: "Karori Stream Monitoring",
    description: "Measure stream health and identify freshwater species with trained coordinators.",
    impact_statement: "Build the evidence needed to protect an urban waterway.", tasks: "Take water readings, photograph sites, and log observations.",
    meeting_point: "Karori Park pavilion", starts_at: future(11), ends_at: future(11), recurrence: "monthly", effort: "light", minimum_age: 16,
    accessibility: "Some uneven stream-bank terrain.", safety_notes: "Wear sturdy waterproof footwear.", capacity: 12, confirmed_count: 7,
    image_url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85",
    status: "published", version: 1, organisation_name: "Waiora Wellington",
    location_label: "Karori, Wellington", address_line: "Karori Park", locality: "Karori", city: "Wellington", postcode: "6012", country_code: "NZ", latitude: -41.2841, longitude: 174.7361, location_visibility: "public",
    causes: [causes[2]!], distance_km: 3.4, is_saved: false,
  },
  {
    id: "hutt-planting", title: "Hutt River Native Planting",
    description: "Restore a riverbank corridor with native plants and local conservation guides.",
    impact_statement: "Create healthier habitat along Te Awa Kairangi.", tasks: "Prepare planting sites, place native seedlings, and spread mulch.",
    meeting_point: "Hutt Recreation Ground river entrance", starts_at: future(14), ends_at: future(14), recurrence: "monthly", effort: "active", minimum_age: 14,
    accessibility: "Mostly level grass with adaptable planting tasks.", safety_notes: "Closed shoes and weatherproof layers recommended.", capacity: 30, confirmed_count: 12,
    image_url: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=85", status: "published", version: 1, organisation_name: "Te Awa Kairangi Trust",
    location_label: "Lower Hutt, Wellington Region", address_line: "Hutt Recreation Ground", locality: "Lower Hutt", city: "Wellington Region", postcode: "5010", country_code: "NZ", latitude: -41.211, longitude: 174.9028, location_visibility: "public",
    causes: [causes[1]!], distance_km: 14.2, is_saved: false,
  },
  {
    id: "porirua-food-rescue", title: "Porirua Food Rescue Sort",
    description: "Sort rescued groceries into whānau food parcels with an experienced community team.",
    impact_statement: "Keep good food out of landfill and support families across Porirua.", tasks: "Check produce, assemble parcels, label dietary needs, and tidy the workspace.",
    meeting_point: "Community hub reception", starts_at: future(17), ends_at: future(17), recurrence: "weekly", effort: "light", minimum_age: 16,
    accessibility: "Step-free indoor workspace.", safety_notes: "Food-safe gloves and training are provided.", capacity: 16, confirmed_count: 6,
    image_url: "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=85", status: "published", version: 1, organisation_name: "Porirua Kai Collective",
    location_label: "Porirua, Wellington Region", address_line: "18 Hartham Place", locality: "Porirua", city: "Wellington Region", postcode: "5022", country_code: "NZ", latitude: -41.1357, longitude: 174.8408, location_visibility: "public",
    causes: [causes[3]!], distance_km: 17.7, is_saved: false,
  },
];
export const profileFor = (role: "volunteer" | "organiser"): Profile => ({
  id: role === "volunteer" ? "00000000-0000-4000-8000-000000000020" : "00000000-0000-4000-8000-000000000010",
  role, display_name: role === "volunteer" ? "Mia Thompson" : "Kaitiaki Coastal Network",
  email: `${role}@example.com`, search_location_label: "Wellington Central, Wellington", search_latitude: -41.2866, search_longitude: 174.7756, search_radius_km: 25, theme: "system",
  organisation_name: role === "organiser" ? "Kaitiaki Coastal Network" : null,
});
export const applications: Application[] = [
  { id: "application-1", opportunity_id: opportunities[0]!.id, opportunity_title: opportunities[0]!.title,
    volunteer_id: profileFor("volunteer").id, volunteer_name: "Mia Thompson", volunteer_email: "volunteer@example.com",
    note: "I care about the coast and can help for the full morning.", experience: "Two previous community cleanups.", availability: "Available for the full event",
    status: "received", version: 1, next_step: "Your application was received. The host will review it next.", history: [] },
];
