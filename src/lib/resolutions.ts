import { useSyncExternalStore } from "react";
import { slotKey, type SlotResolution } from "./conflicts";

/**
 * Conflict-resolution store (issue #5) — sibling of the selection store.
 *
 * Holds the student's "keep this one at the regular time" choices, persisted
 * to localStorage under `apx.resolutions.v1` (versioned per PROJECT.md). Same
 * module-level `useSyncExternalStore` pattern as `selection.ts`: every
 * component sees the same state, SSR renders an empty snapshot, and the
 * persisted value hydrates on the client right after mount.
 *
 * The store persists resolutions verbatim; VALIDITY is decided by the pure
 * functions in `conflicts.ts` against the current selection. `ScheduleView`
 * prunes stale entries back into storage via {@link replaceResolutions} so a
 * cleared conflict re-prompts if the same collision is re-created later.
 */

/** localStorage key — versioned per PROJECT.md ("apx.<name>.vN"). */
export const RESOLUTIONS_STORAGE_KEY = "apx.resolutions.v1";

type Listener = () => void;

const EMPTY: readonly SlotResolution[] = Object.freeze([]);

let current: readonly SlotResolution[] = EMPTY;
let hydrated = false;
const listeners = new Set<Listener>();

function isSlotResolution(value: unknown): value is SlotResolution {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    (r.session === "AM" || r.session === "PM") &&
    typeof r.keeperId === "string" &&
    Array.isArray(r.memberIds) &&
    r.memberIds.length >= 2 &&
    r.memberIds.every((id): id is string => typeof id === "string") &&
    r.memberIds.includes(r.keeperId)
  );
}

function readStorage(): readonly SlotResolution[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(RESOLUTIONS_STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const seen = new Set<string>();
    const resolutions = parsed.filter((entry): entry is SlotResolution => {
      if (!isSlotResolution(entry)) return false;
      const key = slotKey(entry);
      if (seen.has(key)) return false; // one resolution per slot — first wins
      seen.add(key);
      return true;
    });
    return resolutions.length ? Object.freeze(resolutions) : EMPTY;
  } catch {
    // Corrupt/unavailable storage — start with no resolutions.
    return EMPTY;
  }
}

function writeStorage(resolutions: readonly SlotResolution[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RESOLUTIONS_STORAGE_KEY,
      JSON.stringify(resolutions),
    );
  } catch {
    // Storage unavailable (private mode / quota) — resolutions stay in-memory.
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function ensureHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  current = readStorage();
}

function setResolutions(resolutions: readonly SlotResolution[]): void {
  current = resolutions.length ? Object.freeze([...resolutions]) : EMPTY;
  writeStorage(current);
  emit();
}

function subscribe(listener: Listener): () => void {
  ensureHydrated();
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === RESOLUTIONS_STORAGE_KEY) {
      current = readStorage();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): readonly SlotResolution[] {
  return current;
}

function getServerSnapshot(): readonly SlotResolution[] {
  return EMPTY;
}

/** Record the keeper choice for one conflict slot (replaces any prior choice for that slot). */
export function setResolution(resolution: SlotResolution): void {
  ensureHydrated();
  const key = slotKey(resolution);
  setResolutions([
    ...current.filter((existing) => slotKey(existing) !== key),
    {
      date: resolution.date,
      session: resolution.session,
      keeperId: resolution.keeperId,
      memberIds: [...resolution.memberIds],
    },
  ]);
}

/**
 * Overwrite the stored list (used to prune stale resolutions after selection
 * changes). No-op when nothing actually changed, so render-time pruning can
 * call this from an effect without looping.
 */
export function replaceResolutions(
  resolutions: readonly SlotResolution[],
): void {
  ensureHydrated();
  if (
    resolutions.length === current.length &&
    resolutions.every(
      (resolution, i) =>
        slotKey(resolution) === slotKey(current[i]) &&
        resolution.keeperId === current[i].keeperId,
    )
  ) {
    return;
  }
  setResolutions(resolutions);
}

/** Clear all stored resolutions. */
export function clearResolutions(): void {
  ensureHydrated();
  if (current.length === 0) return;
  setResolutions(EMPTY);
}

/**
 * React hook returning the shared, persisted conflict resolutions. Validity
 * against the current selection is the caller's concern (see `conflicts.ts`).
 */
export function useResolutions(): readonly SlotResolution[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
