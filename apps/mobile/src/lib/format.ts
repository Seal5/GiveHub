import type { ApplicationStatus } from "./types";

export const formatEventDate = (value: string) =>
  new Intl.DateTimeFormat("en-NZ", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    timeZone: "Pacific/Auckland",
  }).format(new Date(value));

export const statusLabel: Record<ApplicationStatus, string> = {
  received: "Application received",
  under_review: "Under review",
  confirmed: "You’re in",
  waitlisted: "Waitlisted",
  declined: "Not selected",
  withdrawn: "Withdrawn",
};

