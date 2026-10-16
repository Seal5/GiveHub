import { afterEach, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("react-native-url-polyfill/auto", () => ({}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: () => { throw new Error("SecureStore is not available on web"); },
  setItemAsync: () => { throw new Error("SecureStore is not available on web"); },
  deleteItemAsync: () => { throw new Error("SecureStore is not available on web"); },
}));

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

it("initializes connected browser auth without calling native storage", async () => {
  vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "https://pilot.supabase.co");
  vi.stubEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  const entries = new Map<string, string>();
  const storage = { getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => entries.set(k, v), removeItem: (k: string) => entries.delete(k) };
  vi.stubGlobal("window", { document: {}, localStorage: storage });
  vi.stubGlobal("document", {});
  vi.stubGlobal("localStorage", storage);
  const { supabase } = await import("./supabase");
  const result = await supabase!.auth.getSession();
  expect(result.error).toBeNull();
  expect(result.data.session).toBeNull();
  await supabase!.auth.stopAutoRefresh();
});
