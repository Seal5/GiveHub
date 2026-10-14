import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("keeps a shared opportunity through a browser reload and consumes it once", async () => {
  const entries = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value), removeItem: (key: string) => entries.delete(key) });
  const beforeReload = await import("./pendingRoute");
  beforeReload.setPendingRoute("/(volunteer)/opportunity/beach-clean");
  vi.resetModules();
  const afterReload = await import("./pendingRoute");
  expect(afterReload.takePendingRoute()).toBe("/(volunteer)/opportunity/beach-clean");
  expect(afterReload.takePendingRoute()).toBeNull();
});

it("continues to work when the browser denies storage access", async () => {
  vi.stubGlobal("sessionStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } });
  const route = await import("./pendingRoute");
  route.setPendingRoute("/(volunteer)/opportunity/beach-clean");
  expect(route.takePendingRoute()).toBe("/(volunteer)/opportunity/beach-clean");
});
