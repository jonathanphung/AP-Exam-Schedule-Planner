"use client";

import { useState } from "react";
import { ScheduleView } from "@/components/ScheduleView";
import { CalendarView } from "@/components/CalendarView";

/**
 * View switcher between the "My Schedule" list (issue #4) and the
 * month-calendar grid (issue #19).
 *
 * Defaults to the list view so existing behavior is unchanged on first load.
 * The toggle chips follow the catalog's category-filter pattern: native
 * buttons (keyboard-operable via Tab + Enter/Space), `aria-pressed` state,
 * and the same high-contrast active style (blue-600 on white, ≥4.5:1).
 */

type ViewMode = "list" | "calendar";

const VIEWS: ReadonlyArray<{ mode: ViewMode; label: string }> = [
  { mode: "list", label: "My Schedule" },
  { mode: "calendar", label: "Calendar" },
];

export function ScheduleViews() {
  const [view, setView] = useState<ViewMode>("list");

  return (
    <section aria-label="My exams" className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="Schedule view"
        className="flex flex-wrap gap-2"
      >
        {VIEWS.map(({ mode, label }) => {
          const active = view === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              onClick={() => setView(mode)}
              className={[
                "inline-flex min-h-11 items-center rounded-full border px-4 py-1 text-sm transition sm:min-h-0 sm:px-3",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
                active
                  ? "border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-400 dark:text-slate-950"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      {view === "list" ? <ScheduleView /> : <CalendarView />}
    </section>
  );
}
