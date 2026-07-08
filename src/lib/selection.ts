import { useCallback, useSyncExternalStore } from "react";
import {
  getActiveSelection,
  setActiveSelection,
  subscribeSchedules,
} from "./schedules";

/**
 * "My Exams" selection store — since issue #29 a view onto the ACTIVE
 * schedule in the multi-schedule store (`src/lib/schedules.ts`).
 *
 * The public API is unchanged from the original single-plan store (issue #3):
 * components keep calling {@link useSelection} and the mutators exactly as
 * before, and the app-wide invariants hold — every caller shares the same
 * state, SSR sees an empty snapshot, cross-tab edits sync via the `storage`
 * event. What changed underneath: the ids now live inside the active
 * schedule under `apx.schedules.v1`, and switching schedules swaps the whole
 * selection at once. The legacy `apx.selection.v1` key is still written as a
 * mirror of the active schedule (see schedules.ts) and is the migration
 * source for pre-#29 visitors.
 */

/** Legacy localStorage key (pre-#29) — migration source + active-schedule mirror. */
export const SELECTION_STORAGE_KEY = "apx.selection.v1";

const EMPTY: readonly string[] = Object.freeze([]);

/** Add `id` to the active schedule's selection (no-op if already selected). */
export function addSelection(id: string): void {
  const current = getActiveSelection();
  if (current.includes(id)) return;
  setActiveSelection([...current, id]);
}

/** Remove `id` from the active schedule's selection (no-op if not selected). */
export function removeSelection(id: string): void {
  const current = getActiveSelection();
  if (!current.includes(id)) return;
  setActiveSelection(current.filter((existing) => existing !== id));
}

/** Toggle `id`: select it if absent, deselect it if present. */
export function toggleSelection(id: string): void {
  if (getActiveSelection().includes(id)) removeSelection(id);
  else addSelection(id);
}

/** Clear the active schedule's entire selection. */
export function clearSelection(): void {
  if (getActiveSelection().length === 0) return;
  setActiveSelection(EMPTY);
}

function getServerSnapshot(): readonly string[] {
  return EMPTY;
}

export interface SelectionApi {
  /** Stable, ordered list of selected subject ids. */
  readonly selectedIds: readonly string[];
  /** Number of selected subjects. */
  readonly selectedCount: number;
  /** Whether `id` is currently selected. */
  isSelected: (id: string) => boolean;
  /** Toggle selection for `id`. */
  toggle: (id: string) => void;
  /** Select `id`. */
  add: (id: string) => void;
  /** Deselect `id`. */
  remove: (id: string) => void;
  /** Clear the whole selection. */
  clear: () => void;
}

/**
 * React hook returning the shared "My Exams" selection (of the ACTIVE
 * schedule) and its mutators. Safe to call from any client component; all
 * callers stay in sync.
 */
export function useSelection(): SelectionApi {
  const selectedIds = useSyncExternalStore(
    subscribeSchedules,
    getActiveSelection,
    getServerSnapshot,
  );

  const isSelected = useCallback(
    (id: string) => selectedIds.includes(id),
    [selectedIds],
  );

  return {
    selectedIds,
    selectedCount: selectedIds.length,
    isSelected,
    toggle: toggleSelection,
    add: addSelection,
    remove: removeSelection,
    clear: clearSelection,
  };
}
