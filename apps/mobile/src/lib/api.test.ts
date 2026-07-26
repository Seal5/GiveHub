import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("mobile runtime mode", () => {
  it("uses fixtures only when demo mode is explicitly enabled", async () => {
    vi.stubEnv("EXPO_PUBLIC_DEMO_MODE", "true");
    vi.stubEnv("EXPO_PUBLIC_API_URL", "");

    const runtime = await import("./api");

    expect(runtime.demoMode).toBe(true);
    expect(runtime.apiConfigurationError).toBeNull();
  });

  it("does not silently fall back to demo mode when configuration is missing", async () => {
    vi.stubEnv("EXPO_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("EXPO_PUBLIC_API_URL", "");

    const runtime = await import("./api");

    expect(runtime.demoMode).toBe(false);
    expect(runtime.apiConfigurationError).toContain("EXPO_PUBLIC_API_URL is missing");
  });

  it("uses the connected API when its URL is configured", async () => {
    vi.stubEnv("EXPO_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://192.168.1.100:8000");

    const runtime = await import("./api");

    expect(runtime.demoMode).toBe(false);
    expect(runtime.apiConfigured).toBe(true);
    expect(runtime.apiConfigurationError).toBeNull();
  });

  it("supports persistent local API data without Supabase Auth", async () => {
    vi.stubEnv("EXPO_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("EXPO_PUBLIC_LOCAL_AUTH", "true");
    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://127.0.0.1:8000");

    const runtime = await import("./api");

    expect(runtime.demoMode).toBe(false);
    expect(runtime.localAuthMode).toBe(true);
    expect(runtime.apiConfigured).toBe(true);
    expect(runtime.apiConfigurationError).toBeNull();
  });
});
