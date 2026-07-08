import { useSyncExternalStore } from "react";

/**
 * Desktop sidebar collapse state (issue #29), remembered client-side under
 * `apx.sidebar.v1` (versioned per PROJECT.md). Same SSR-safe module-level
 * `useSyncExternalStore` pattern as the other stores: the server and the
 * first client render see "expanded" (no hydration mismatch); the remembered
 * choice applies right after mount. Deliberately no cross-tab `storage`
 * listener — collapsing a panel is a per-view preference, not plan data.
 */

/** localStorage key — versioned per PROJECT.md ("apx.<name>.vN"). */
export const SIDEBAR_STORAGE_KEY = "apx.sidebar.v1";

type Listener = () => void;

let collapsed = false;
let hydrated = false;
const listeners = new Set<Listener>();

function readStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

function ensureHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  collapsed = readStorage();
}

function subscribe(listener: Listener): () => void {
  ensureHydrated();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return collapsed;
}

function getServerSnapshot(): boolean {
  return false;
}

/** Flip the collapse state and remember the choice for future visits. */
export function toggleSidebarCollapsed(): void {
  ensureHydrated();
  collapsed = !collapsed;
  try {
    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      collapsed ? "collapsed" : "expanded",
    );
  } catch {
    // Storage unavailable — the choice lasts for this session only.
  }
  for (const listener of listeners) listener();
}

/** Whether the desktop sidebar is currently collapsed. */
export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
