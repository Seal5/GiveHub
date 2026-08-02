import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const event = {
  id: "beach-clean",
  title: "Woodbine Beach Cleanup",
  organisation_name: "Toronto Community Action Network",
  starts_at: "2026-08-01T21:00:00.000Z",
  location_label: "The Beaches, Toronto",
};

describe("opportunity share links", () => {
  it("builds a link against the dedicated share domain", async () => {
    vi.stubEnv("EXPO_PUBLIC_SHARE_BASE_URL", "https://givehub.nz");
    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://127.0.0.1:8000");

    const { opportunityShareUrl } = await import("./shareLink");

    expect(opportunityShareUrl("beach-clean")).toBe("https://givehub.nz/o/beach-clean");
  });

  it("falls back to the API host so links still resolve without a marketing domain", async () => {
    vi.stubEnv("EXPO_PUBLIC_SHARE_BASE_URL", "");
    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://127.0.0.1:8000/");

    const { opportunityShareUrl } = await import("./shareLink");

    expect(opportunityShareUrl("beach-clean")).toBe("http://127.0.0.1:8000/o/beach-clean");
  });

  it("returns null rather than a broken link when nothing is configured", async () => {
    vi.stubEnv("EXPO_PUBLIC_SHARE_BASE_URL", "");
    vi.stubEnv("EXPO_PUBLIC_API_URL", "");

    const { opportunityShareUrl } = await import("./shareLink");

    expect(opportunityShareUrl("beach-clean")).toBeNull();
  });

  it("names the event and host in the shared message", async () => {
    vi.stubEnv("EXPO_PUBLIC_SHARE_BASE_URL", "https://givehub.nz");

    const { opportunityShareMessage } = await import("./shareLink");
    const message = opportunityShareMessage(event);

    expect(message).toContain("Woodbine Beach Cleanup");
    expect(message).toContain("Toronto Community Action Network");
    expect(message).toContain("The Beaches, Toronto");
  });
});
