/**
 * Holds the destination a deep link asked for while the person signs in, so a
 * shared opportunity link survives the welcome and auth screens.
 */
let pendingRoute: string | null = null;
const key = "givehub.pending-opportunity";

export function setPendingRoute(route: string | null): void {
  pendingRoute = route;
  try {
    if (typeof sessionStorage !== "undefined") {
      if (route) sessionStorage.setItem(key, JSON.stringify({ route, expires: Date.now() + 3600000 }));
      else sessionStorage.removeItem(key);
    }
  } catch { /* Native and restricted browser contexts can retain the in-memory destination. */ }
}

/** Returns the stored route once, then clears it. */
export function takePendingRoute(): string | null {
  let route = pendingRoute;
  try {
    if (!route && typeof sessionStorage !== "undefined") {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (saved?.expires > Date.now() && typeof saved.route === "string" && /^\/\(volunteer\)\/opportunity\/[a-zA-Z0-9_-]+$/.test(saved.route)) route = saved.route;
    }
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key);
  } catch { /* A stale or unavailable browser store must not block navigation. */ }
  pendingRoute = null;
  return route;
}
