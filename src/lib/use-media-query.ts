"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * SSR-safe media-query hook (issue #22).
 *
 * Subscribes to `window.matchMedia(query)` via `useSyncExternalStore`, so
 * every consumer re-renders exactly when the query flips (e.g. rotating a
 * phone or resizing across a breakpoint). The server snapshot is `false`,
 * which the client's first (hydration) render also uses — no hydration
 * mismatch; the real value applies immediately after mount, the same
 * post-mount hydration model the selection store already uses.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [query],
  );
  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );
  const getServerSnapshot = useCallback(() => false, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
