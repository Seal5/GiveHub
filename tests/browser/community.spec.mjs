import { test, expect } from "@playwright/test";

test.skip(!process.env.GIVEHUB_E2E_API_URL, "Set GIVEHUB_E2E_API_URL to an isolated development API with local auth enabled in the web build.");
const api = process.env.GIVEHUB_E2E_API_URL;
const hostHeaders = { Authorization: "Bearer dev:00000000-0000-4000-8000-000000000010", "Content-Type": "application/json" };

test("organizer creates and publishes an invitation; an independent guest RSVPs, reloads, and changes their response", async ({ page, browser, request }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let eventId;
  const guestContext = await browser.newContext({ baseURL: process.env.GIVEHUB_E2E_WEB_URL ?? "http://localhost:8081" });
  try {
    await page.goto("/auth/organiser?mode=signin");
    await page.getByLabel("Email address", { exact: true }).fill("organiser@example.com");
    await page.getByLabel("Password", { exact: true }).fill("GiveHubTest123!");
    await page.getByRole("button", { name: "Organiser sign in", exact: true }).click();
    await page.getByRole("button", { name: "Host a community event", exact: true }).waitFor();
    await page.getByRole("button", { name: "Host a community event", exact: true }).click();
    await page.getByRole("button", { name: "Create community event", exact: true }).click();
    const title = `TEST Community browser ${Date.now()}`;
    await page.getByLabel("Event title", { exact: true }).fill(title);
    await page.getByLabel("What's the plan?", { exact: true }).fill("A friendly neighbourhood gathering, created by the browser test.");
    await page.getByLabel("Location", { exact: true }).fill("Test community kitchen, Toronto");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.waitForURL(/\/community-event\//);
    eventId = page.url().split("/").pop();
    await page.getByRole("button", { name: "Publish invitation", exact: true }).click();
    await expect(page.getByRole("button", { name: "Copy invite link", exact: true })).toBeVisible();
    const guest = await guestContext.newPage();
    guest.on("pageerror", error => errors.push(error.message));
    await guest.goto(`/g/${eventId}`);
    await guest.getByLabel("Your name", { exact: true }).fill("Browser Test Guest");
    await guest.getByLabel("Email address", { exact: true }).fill(`guest-${Date.now()}@example.com`);
    await guest.getByRole("button", { name: "Send RSVP", exact: true }).click();
    await expect(guest.getByRole("button", { name: "Update my RSVP", exact: true })).toBeVisible();
    await guest.reload();
    await expect(guest.getByRole("button", { name: "Update my RSVP", exact: true })).toBeVisible();
    await expect(guest.getByLabel("Your name", { exact: true })).toHaveValue("Browser Test Guest");
    await page.reload();
    await page.getByRole("button", { name: "Review Browser Test Guest", exact: true }).click();
    await expect(page.getByText("Browser Test Guest", { exact: true }).last()).toBeVisible();
    await guest.getByRole("button", { name: "Maybe", exact: true }).click();
    await guest.getByRole("button", { name: "Update my RSVP", exact: true }).click();
    await expect(guest.getByText("You're all set. Maybe.", { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Review Browser Test Guest", exact: true }).click();
    await expect(page.getByText("Guest's response: Maybe", { exact: true })).toBeVisible();
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export guest CSV", exact: true }).click();
    expect((await dl).suggestedFilename()).toBe("givehub-guests.csv");
    await guest.setViewportSize({ width: 390, height: 844 });
    await expect(guest.getByRole("button", { name: "Update my RSVP", exact: true })).toBeVisible();
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await guestContext.close();
    if (eventId) {
      const response = await request.get(`${api}/v1/organiser/community/events/${eventId}`, { headers: hostHeaders });
      const event = await response.json();
      if (event.status !== "cancelled") await request.post(`${api}/v1/organiser/community/events/${eventId}/status`, { headers: hostHeaders, data: { status: "cancelled", version: event.version } });
    }
  }
});
