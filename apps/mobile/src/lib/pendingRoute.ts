/**
 * Holds the destination a deep link asked for while the person signs in, so a
 * shared opportunity link survives the welcome and auth screens.
 */
let pendingRoute: string | null = null;

export function setPendingRoute(route: string | null): void {
  pendingRoute = route;
}

/** Returns the stored route once, then clears it. */
export function takePendingRoute(): string | null {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
}
