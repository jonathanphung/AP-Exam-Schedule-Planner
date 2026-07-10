import { useSyncExternalStore } from "react";
import { slotKey, type SlotResolution } from "./conflicts";
import {
  getActiveResolutions,
  setActiveResolutions,
  subscribeSchedules,
} from "./schedules";

/**
 * Conflict-resolution store (issue #5) — since issue #29 a view onto the
 * ACTIVE schedule in the multi-schedule store (`src/lib/schedules.ts`).
 *
 * The public API is unchanged: components keep calling {@link useResolutions}
 * / {@link setResolution} / {@link replaceResolutions} exactly as before.
 * Underneath, each schedule owns its OWN resolution list — switching
 * schedules swaps the resolutions together with the selection, so one
 * schedule's late-testing choices never leak into another (issue #29 AC).
 *
 * The store persists resolutions verbatim; VALIDITY is decided by the pure
 * functions in `conflicts.ts` against the current selection. `ScheduleView`
 * prunes stale entries back into storage via {@link replaceResolutions} so a
 * cleared conflict re-prompts if the same collision is re-created later.
 * The legacy `apx.resolutions.v1` key is still written as a mirror of the
 * active schedule (see schedules.ts) and is the migration source for pre-#29
 * visitors.
 */

/** Legacy localStorage key (pre-#29) — migration source + active-schedule mirror. */
export const RESOLUTIONS_STORAGE_KEY = "apx.resolutions.v1";

const EMPTY: readonly SlotResolution[] = Object.freeze([]);

/** Record the keeper choice for one conflict slot (replaces any prior choice for that slot). */
export function setResolution(resolution: SlotResolution): void {
  const current = getActiveResolutions();
  const key = slotKey(resolution);
  setActiveResolutions([
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
 * Overwrite the active schedule's stored list (used to prune stale
 * resolutions after selection changes). No-op when nothing actually changed,
 * so render-time pruning can call this from an effect without looping.
 */
export function replaceResolutions(
  resolutions: readonly SlotResolution[],
): void {
  const current = getActiveResolutions();
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
  setActiveResolutions(resolutions);
}

/** Clear all of the active schedule's resolutions. */
export function clearResolutions(): void {
  if (getActiveResolutions().length === 0) return;
  setActiveResolutions(EMPTY);
}

function getServerSnapshot(): readonly SlotResolution[] {
  return EMPTY;
}

/**
 * React hook returning the ACTIVE schedule's persisted conflict resolutions.
 * Validity against the current selection is the caller's concern (see
 * `conflicts.ts`).
 */
export function useResolutions(): readonly SlotResolution[] {
  return useSyncExternalStore(
    subscribeSchedules,
    getActiveResolutions,
    getServerSnapshot,
  );
}
