"use client";

import { useState } from "react";
import apData from "@/data/ap-2026.json";
import type { ApDataset } from "@/data/schema";
import { ScheduleView } from "@/components/ScheduleView";
import { CalendarView } from "@/components/CalendarView";
import { ExportButton } from "@/components/ExportButton";

/**
 * "My Schedule" section shell: the shared header + view switcher over the
 * list (issue #4) and the week-paged calendar grid (issue #19).
 *
 * Layout per the issue-19 second design bounce (item B):
 * - The "My Schedule" heading, the cycle banner, and the Export button live
 *   HERE, so they are present on both views (Export stays visible on the
 *   calendar, not just the list).
 * - The view switcher sits BELOW that header, with the chips labeled
 *   "List" and "Calendar".
 * - The CALENDAR is the default view on load.
 *
 * The toggle chips follow the catalog's category-filter pattern: native
 * buttons (keyboard-operable via Tab + Enter/Space), `aria-pressed` state,
 * and the same high-contrast active style (blue-600 on white, ≥4.5:1).
 */

// The banner reads the cycle from dataset metadata — never hardcoded, so a
// dataset swap (May 2027) re-labels the section automatically.
const CYCLE = (apData as unknown as ApDataset).cycle;

type ViewMode = "list" | "calendar";

const VIEWS: ReadonlyArray<{ mode: ViewMode; label: string }> = [
  { mode: "list", label: "List" },
  { mode: "calendar", label: "Calendar" },
];

export function ScheduleViews() {
  const [view, setView] = useState<ViewMode>("calendar");

  return (
    <section aria-label="My exams" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight">My Schedule</h2>
        <div className="flex flex-wrap items-center gap-2">
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 dark:border-blue-500/40 dark:bg-blue-950/40 dark:text-blue-200">
            <span aria-hidden="true">📅</span>
            Dates reflect the {CYCLE} AP exam cycle.
          </p>
          <ExportButton />
        </div>
      </div>

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
