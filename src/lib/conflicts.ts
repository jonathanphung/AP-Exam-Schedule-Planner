import type { ApSubject, ExamSlot, Session } from "../data/schema";

/**
 * Pure conflict-detection and late-testing resolution logic (issue #5).
 *
 * A "conflict" is two or more *selected* subjects whose regular exams share the
 * same calendar date AND session (AM/PM). The student resolves a conflict by
 * choosing exactly one subject to keep at the regular time; every other member
 * of that group moves to ITS OWN published late-testing slot from the dataset.
 *
 * Everything here is pure and dataset-driven — no invented dates. The resolved
 * slot of a moved exam is always `subject.lateTesting` verbatim (the schema
 * guarantees every subject with a regular exam has a published late slot).
 *
 * Portfolio deadlines NEVER participate in conflict detection: only
 * `subject.exam` slots are grouped.
 *
 * Consumers:
 *   - `ScheduleView` (issue #5) renders resolved slots + prompts + warnings.
 *   - ICS export (issue #7) should call {@link resolveSlots} to get the
 *     effective date/session per selected subject.
 */

/** A same-slot conflict: ≥2 selected subjects sharing one regular exam slot. */
export interface ConflictGroup {
  /** The shared regular slot (date + AM/PM session). */
  slot: ExamSlot;
  /** Ids of every selected subject whose regular exam sits in `slot`, in dataset order. */
  subjectIds: string[];
}

/**
 * A persisted resolution for one conflict group (localStorage
 * `apx.resolutions.v1` stores an array of these).
 *
 * `memberIds` snapshots the full colliding set at resolution time. A stored
 * resolution is only honored while the *current* colliding group for that slot
 * has exactly the same members — deselecting any involved subject (or adding a
 * new subject to the same slot) invalidates it, returning every member to its
 * regular slot and re-raising the prompt if a collision still exists.
 */
export interface SlotResolution {
  /** Regular-slot date the conflict occurred on (ISO calendar date). */
  date: string;
  /** Regular-slot session the conflict occurred on. */
  session: Session;
  /** The subject that stays at the regular time. */
  keeperId: string;
  /** Every subject involved in the conflict when it was resolved (includes the keeper). */
  memberIds: string[];
}

/** The effective slot a selected subject's exam should render/export at. */
export interface ResolvedSlot {
  subjectId: string;
  /** ISO calendar date — regular exam date, or the late-testing date when moved. */
  date: string;
  session: Session;
  /** True when a conflict resolution moved this exam to its late-testing slot. */
  movedToLate: boolean;
}

/** Two or more *moved* exams whose late-testing slots collide with each other. */
export interface LateCollision {
  slot: ExamSlot;
  subjectIds: string[];
}

/** Canonical key for a date+session slot (used for grouping and matching). */
export function slotKey(slot: { date: string; session: Session }): string {
  return `${slot.date}:${slot.session}`;
}

/**
 * Group the selected subjects' REGULAR exam slots and return every slot shared
 * by two or more of them, in chronological slot order.
 *
 * Portfolio deadlines are ignored entirely (AC: portfolio deadlines never
 * trigger the conflict flow), as are unselected subjects and subjects with no
 * May exam.
 */
export function findSameSlotConflicts(
  subjects: readonly ApSubject[],
  selectedIds: readonly string[],
): ConflictGroup[] {
  const selected = new Set(selectedIds);
  const bySlot = new Map<string, ConflictGroup>();

  for (const subject of subjects) {
    if (!selected.has(subject.id) || !subject.exam) continue;
    const key = slotKey(subject.exam);
    const group = bySlot.get(key);
    if (group) {
      group.subjectIds.push(subject.id);
    } else {
      bySlot.set(key, {
        slot: { date: subject.exam.date, session: subject.exam.session },
        subjectIds: [subject.id],
      });
    }
  }

  return Array.from(bySlot.values())
    .filter((group) => group.subjectIds.length >= 2)
    .sort((a, b) => (slotKey(a.slot) < slotKey(b.slot) ? -1 : 1));
}

/**
 * A stored resolution is valid iff the current conflicts contain a group on
 * the same slot with EXACTLY the same member set, and the keeper is a member.
 * Anything else (subject deselected, new subject joined the slot, dataset
 * changed) makes it stale.
 */
export function isResolutionValid(
  resolution: SlotResolution,
  conflicts: readonly ConflictGroup[],
): boolean {
  const key = slotKey(resolution);
  const group = conflicts.find((g) => slotKey(g.slot) === key);
  if (!group) return false;
  if (!resolution.memberIds.includes(resolution.keeperId)) return false;

  const current = [...group.subjectIds].sort();
  const stored = Array.from(new Set(resolution.memberIds)).sort();
  return (
    current.length === stored.length &&
    current.every((id, i) => id === stored[i])
  );
}

/**
 * Drop stale resolutions (and duplicate entries for the same slot — first
 * wins). The result is what should be honored AND what should be persisted
 * back to `apx.resolutions.v1`.
 */
export function pruneResolutions(
  resolutions: readonly SlotResolution[],
  conflicts: readonly ConflictGroup[],
): SlotResolution[] {
  const seen = new Set<string>();
  return resolutions.filter((resolution) => {
    const key = slotKey(resolution);
    if (seen.has(key)) return false;
    seen.add(key);
    return isResolutionValid(resolution, conflicts);
  });
}

/** Conflict groups that do not yet have a valid stored resolution — these need a prompt. */
export function unresolvedConflicts(
  conflicts: readonly ConflictGroup[],
  resolutions: readonly SlotResolution[],
): ConflictGroup[] {
  const resolvedKeys = new Set(
    pruneResolutions(resolutions, conflicts).map((r) => slotKey(r)),
  );
  return conflicts.filter((group) => !resolvedKeys.has(slotKey(group.slot)));
}

/**
 * Compute the effective exam slot for every selected subject that has a
 * regular exam. This is THE resolved-slot function — the schedule view and the
 * ICS export (issue #7) must both render/export from its output, never from
 * `subject.exam` directly.
 *
 * - Default: the subject's regular slot (`movedToLate: false`).
 * - Non-keeper members of a VALID resolution: the subject's own published
 *   late-testing slot (`movedToLate: true`). Stale resolutions are ignored,
 *   so deselecting an involved subject returns the others to regular slots.
 * - Defensive: if a non-keeper somehow has no published late slot, it stays at
 *   its regular slot — we never invent a date.
 */
export function resolveSlots(
  subjects: readonly ApSubject[],
  selectedIds: readonly string[],
  resolutions: readonly SlotResolution[],
): Map<string, ResolvedSlot> {
  const conflicts = findSameSlotConflicts(subjects, selectedIds);
  const valid = pruneResolutions(resolutions, conflicts);

  const movedIds = new Set<string>();
  for (const resolution of valid) {
    for (const id of resolution.memberIds) {
      if (id !== resolution.keeperId) movedIds.add(id);
    }
  }

  const selected = new Set(selectedIds);
  const resolved = new Map<string, ResolvedSlot>();
  for (const subject of subjects) {
    if (!selected.has(subject.id) || !subject.exam) continue;
    if (movedIds.has(subject.id) && subject.lateTesting) {
      resolved.set(subject.id, {
        subjectId: subject.id,
        date: subject.lateTesting.date,
        session: subject.lateTesting.session,
        movedToLate: true,
      });
    } else {
      resolved.set(subject.id, {
        subjectId: subject.id,
        date: subject.exam.date,
        session: subject.exam.session,
        movedToLate: false,
      });
    }
  }
  return resolved;
}

/**
 * Detect late-testing slots now shared by two or more MOVED exams. These get a
 * visible warning on the schedule (no silent overwrite, no forced second
 * resolution — the swap details are the AP coordinator's call).
 */
export function findLateLateCollisions(
  resolved: ReadonlyMap<string, ResolvedSlot>,
): LateCollision[] {
  const bySlot = new Map<string, LateCollision>();
  for (const slot of resolved.values()) {
    if (!slot.movedToLate) continue;
    const key = slotKey(slot);
    const collision = bySlot.get(key);
    if (collision) {
      collision.subjectIds.push(slot.subjectId);
    } else {
      bySlot.set(key, {
        slot: { date: slot.date, session: slot.session },
        subjectIds: [slot.subjectId],
      });
    }
  }
  return Array.from(bySlot.values())
    .filter((collision) => collision.subjectIds.length >= 2)
    .sort((a, b) => (slotKey(a.slot) < slotKey(b.slot) ? -1 : 1));
}
