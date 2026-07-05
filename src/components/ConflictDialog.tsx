"use client";

import { useId } from "react";
import type { ApSubject } from "@/data/schema";
import type { ConflictGroup } from "@/lib/conflicts";
import { formatDateLabel } from "@/lib/schedule";

/**
 * Conflict prompt (issue #5): shown for every same-slot exam collision that
 * has no valid stored resolution yet. Names every involved subject and the
 * shared slot, and asks which ONE exam stays at the regular time — each of the
 * others moves to its own published late-testing slot.
 *
 * Rendered inline on the schedule (not an overlay) so it works with keyboard
 * and screen readers without focus-trap machinery: it's a group of buttons
 * labeled by the prompt heading.
 */

export const COORDINATOR_NOTE =
  "This is a planning choice — the actual late-testing swap is arranged through your school's AP coordinator.";

/** "A and B" / "A, B, and C" */
export function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export interface ConflictDialogProps {
  /** The unresolved same-slot conflict to prompt for. */
  group: ConflictGroup;
  /** Subject lookup for names + late-testing slots. */
  subjectsById: ReadonlyMap<string, ApSubject>;
  /** Called with the id of the subject the student keeps at the regular time. */
  onKeep: (keeperId: string) => void;
}

export function ConflictDialog({
  group,
  subjectsById,
  onKeep,
}: ConflictDialogProps) {
  const headingId = useId();
  const names = group.subjectIds.map(
    (id) => subjectsById.get(id)?.name ?? id,
  );
  const slotLabel = `${formatDateLabel(group.slot.date)} (${group.slot.session} session)`;

  return (
    <section
      role="group"
      aria-labelledby={headingId}
      data-testid="conflict-prompt"
      className="rounded-lg border-2 border-red-300 bg-red-50 p-4 dark:border-red-500/50 dark:bg-red-950/40"
    >
      <h3
        id={headingId}
        className="text-sm font-bold uppercase tracking-wide text-red-900 dark:text-red-100"
      >
        <span aria-hidden="true">⚠️ </span>
        Exam time conflict
      </h3>

      <p className="mt-2 text-sm text-red-900 dark:text-red-100">
        {nameList(names)} are {names.length > 2 ? "all" : "both"} scheduled
        for {slotLabel}. Which exam will you take at the regular time? Each of
        the others moves to its own official late-testing slot:
      </p>

      <ul className="mt-2 list-disc pl-5 text-sm text-red-900 dark:text-red-100">
        {group.subjectIds.map((id) => {
          const subject = subjectsById.get(id);
          const late = subject?.lateTesting;
          return (
            <li key={id}>
              <span className="font-medium">{subject?.name ?? id}</span>
              {late
                ? ` — late testing ${formatDateLabel(late.date)} (${late.session} session)`
                : " — no published late-testing slot"}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {group.subjectIds.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onKeep(id)}
            className="rounded-md bg-red-700 px-3 py-2 text-left text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:focus-visible:outline-red-300"
          >
            Keep {subjectsById.get(id)?.name ?? id} at the regular time
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs italic text-red-800 dark:text-red-200">
        {COORDINATOR_NOTE}
      </p>
    </section>
  );
}
