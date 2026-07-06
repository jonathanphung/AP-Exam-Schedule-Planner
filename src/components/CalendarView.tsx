"use client";

import { useMemo } from "react";
import apData from "@/data/ap-2026.json";
import {
  CATEGORIES,
  type ApDataset,
  type ApSubject,
  type Category,
} from "@/data/schema";
import { useSelection } from "@/lib/selection";
import { useResolutions } from "@/lib/resolutions";
import { resolveSlots } from "@/lib/conflicts";
import { buildSchedule, formatDateLabel } from "@/lib/schedule";
import {
  buildCalendarLayout,
  hourLabel,
  monthDayLabel,
  weekdayLabel,
  weekRangeLabel,
  NOMINAL_BLOCK_HOURS,
  type CalendarBlock,
  type CalendarWeekLayout,
  type OffGridEntry,
} from "@/lib/calendar";

/**
 * Month-calendar grid view of the selected exams (issue #19).
 *
 * A UT-Registration-Plus-style time grid, except the columns are REAL May
 * 2026 dates (the published testing windows from the dataset schema), laid
 * out week by week and vertically scrollable so the whole month is reachable.
 *
 * Exams read through the same conflict-resolution layer as the list view
 * (`resolveSlots` → `buildSchedule`), so a moved exam renders at its
 * late-testing slot here exactly as it does there. Blocks anchor at the
 * dataset's published session START times; heights are a fixed nominal
 * {@link NOMINAL_BLOCK_HOURS} axis-hours because College Board publishes no
 * durations (see `src/lib/calendar.ts` for the documented design decision).
 * Portfolio deadlines and undated subjects are LISTED beside the grid —
 * never positioned at an invented time (PRD §7.5).
 */

// The dataset ships bundled and is validated by `pnpm test:data`; the JSON
// module's inferred type is widened, so re-assert the schema's types here.
const dataset = apData as unknown as ApDataset;
const SUBJECTS: readonly ApSubject[] = dataset.subjects;
const CATEGORIES_BY_ID: ReadonlyMap<string, Category> = new Map(
  SUBJECTS.map((subject) => [subject.id, subject.category]),
);
const CYCLE = dataset.cycle;
const SESSION_START_TIMES = dataset.sessionStartTimes;

/** Pixel height of one axis hour (drives all block positioning). */
const HOUR_PX = 44;

/**
 * Category → block/legend colors. Every text/background pair meets WCAG AA
 * (≥4.5:1): *-900 on *-100 in light mode, *-100 on *-950 in dark mode.
 * There is no prior category color-coding in the app (categories render as
 * plain text in the catalog), so this map establishes the palette.
 */
const CATEGORY_STYLES: Record<
  Category,
  { block: string; dot: string }
> = {
  STEM: {
    block:
      "border-emerald-600 bg-emerald-100 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-100",
    dot: "bg-emerald-600 dark:bg-emerald-400",
  },
  Humanities: {
    block:
      "border-indigo-600 bg-indigo-100 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-100",
    dot: "bg-indigo-600 dark:bg-indigo-400",
  },
  Languages: {
    block:
      "border-rose-600 bg-rose-100 text-rose-900 dark:border-rose-400 dark:bg-rose-950 dark:text-rose-100",
    dot: "bg-rose-600 dark:bg-rose-400",
  },
  Arts: {
    block:
      "border-fuchsia-600 bg-fuchsia-100 text-fuchsia-900 dark:border-fuchsia-400 dark:bg-fuchsia-950 dark:text-fuchsia-100",
    dot: "bg-fuchsia-600 dark:bg-fuchsia-400",
  },
  "Career Kickstart": {
    block:
      "border-cyan-600 bg-cyan-100 text-cyan-900 dark:border-cyan-400 dark:bg-cyan-950 dark:text-cyan-100",
    dot: "bg-cyan-600 dark:bg-cyan-400",
  },
};

const FALLBACK_BLOCK_STYLE =
  "border-slate-600 bg-slate-100 text-slate-900 dark:border-slate-400 dark:bg-slate-800 dark:text-slate-100";

function ExamBlock({
  block,
  axisStartHour,
}: {
  block: CalendarBlock;
  axisStartHour: number;
}) {
  const top = (block.startHour - axisStartHour) * HOUR_PX;
  const height = NOMINAL_BLOCK_HOURS * HOUR_PX - 4;
  const widthPct = 100 / block.laneCount;
  const style = block.category
    ? CATEGORY_STYLES[block.category].block
    : FALLBACK_BLOCK_STYLE;

  return (
    <li
      data-testid="calendar-block"
      data-subject-id={block.subjectId}
      title={`${block.subjectName} — ${block.session} session, ${block.startLabel}${block.movedToLate ? " (moved to late testing)" : ""}`}
      className={`absolute overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-xs leading-tight ${style}`}
      style={{
        top: `${top + 1}px`,
        height: `${height}px`,
        left: `${block.laneIndex * widthPct}%`,
        width: `calc(${widthPct}% - 3px)`,
      }}
    >
      <p className="font-semibold break-words">{block.subjectName}</p>
      <p className="mt-0.5">
        {block.session} · {block.startLabel}
      </p>
      {block.movedToLate && (
        <p className="mt-0.5 font-medium italic">Moved to late testing</p>
      )}
    </li>
  );
}

function WeekGrid({
  week,
  axisStartHour,
  axisEndHour,
}: {
  week: CalendarWeekLayout;
  axisStartHour: number;
  axisEndHour: number;
}) {
  const hours: number[] = [];
  for (let h = axisStartHour; h < axisEndHour; h += 1) hours.push(h);
  const bodyHeight = hours.length * HOUR_PX;

  return (
    <section
      aria-label={
        week.late
          ? `Late-testing week, ${weekRangeLabel(week.days.map((d) => d.date))}`
          : `Week of ${weekRangeLabel(week.days.map((d) => d.date))}`
      }
      className="flex flex-col gap-2"
    >
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {weekRangeLabel(week.days.map((d) => d.date))}
        {week.late && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-violet-900 dark:bg-violet-500/30 dark:text-violet-200">
            Late testing
          </span>
        )}
      </h3>

      {/* The grid may scroll horizontally INSIDE this container at narrow
          viewports; the page body itself never scrolls horizontally. */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="min-w-[560px] sm:min-w-[640px]">
          {/* Header row: weekday + calendar date per column. */}
          <div
            className="grid border-b border-slate-200 dark:border-slate-800"
            style={{
              gridTemplateColumns: `3.5rem repeat(${week.days.length}, minmax(0, 1fr))`,
            }}
          >
            <div aria-hidden="true" className="sticky left-0 z-10 bg-white dark:bg-slate-950" />
            {week.days.map((day) => (
              <div
                key={day.date}
                className="border-l border-slate-200 px-2 py-2 text-center dark:border-slate-800"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {weekdayLabel(day.date)}
                  <span aria-hidden="true"> · </span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {monthDayLabel(day.date)}
                  </span>
                </p>
              </div>
            ))}
          </div>

          {/* Body: time axis + day columns with positioned blocks. */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: `3.5rem repeat(${week.days.length}, minmax(0, 1fr))`,
            }}
          >
            <div
              aria-hidden="true"
              className="sticky left-0 z-10 bg-white dark:bg-slate-950"
              style={{ height: `${bodyHeight}px` }}
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="pt-0.5 pr-1.5 text-right text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400"
                  style={{ height: `${HOUR_PX}px` }}
                >
                  {hourLabel(hour)}
                </div>
              ))}
            </div>

            {week.days.map((day) => (
              <div
                key={day.date}
                className="relative border-l border-slate-200 dark:border-slate-800"
                style={{ height: `${bodyHeight}px` }}
              >
                {/* Hour gridlines (the header's border-b marks the first line). */}
                {hours.map((hour, index) => (
                  <div
                    key={hour}
                    aria-hidden="true"
                    className={
                      index === 0
                        ? ""
                        : "border-t border-slate-100 dark:border-slate-800/60"
                    }
                    style={{ height: `${HOUR_PX}px` }}
                  />
                ))}
                {day.blocks.length > 0 && (
                  <ul aria-label={`Exams on ${formatDateLabel(day.date)}`}>
                    {day.blocks.map((block) => (
                      <ExamBlock
                        key={block.key}
                        block={block}
                        axisStartHour={axisStartHour}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function offGridLabel(item: OffGridEntry): string {
  switch (item.reason) {
    case "portfolio":
      return `Portfolio due ${formatDateLabel(item.entry.date)}`;
    case "no-published-time":
      return `${formatDateLabel(item.entry.date)} — session start time not published`;
    case "outside-windows":
      return `${formatDateLabel(item.entry.date)} — outside the published testing windows`;
  }
}

export function CalendarView() {
  const { selectedIds, selectedCount } = useSelection();
  const storedResolutions = useResolutions();

  // Same effective-slot pipeline as the list view: `resolveSlots` prunes stale
  // resolutions internally, so both views render identical slots from the same
  // stored state.
  const resolvedSlots = useMemo(
    () => resolveSlots(SUBJECTS, selectedIds, storedResolutions),
    [selectedIds, storedResolutions],
  );

  const schedule = useMemo(
    () => buildSchedule(SUBJECTS, selectedIds, resolvedSlots),
    [selectedIds, resolvedSlots],
  );

  const layout = useMemo(
    () => buildCalendarLayout(schedule, SESSION_START_TIMES, CATEGORIES_BY_ID),
    [schedule],
  );

  const usedCategories = useMemo(() => {
    const used = new Set<Category>();
    for (const week of layout.weeks)
      for (const day of week.days)
        for (const block of day.blocks)
          if (block.category) used.add(block.category);
    return CATEGORIES.filter((category) => used.has(category));
  }, [layout]);

  return (
    <div data-testid="calendar-view" className="flex flex-col gap-4">
      {/* Banner: cycle read from dataset metadata, mirroring the list view. */}
      <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 dark:border-blue-500/40 dark:bg-blue-950/40 dark:text-blue-200">
        <span aria-hidden="true">📅</span>
        Dates reflect the {CYCLE} AP exam cycle.
      </p>

      {selectedCount === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Select subjects above to build your calendar — exams will appear on
          the grid at their session start times.
        </p>
      ) : (
        <>
          {usedCategories.length > 0 && (
            <ul
              aria-label="Category color legend"
              className="flex flex-wrap gap-x-4 gap-y-1"
            >
              {usedCategories.map((category) => (
                <li
                  key={category}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 rounded-full ${CATEGORY_STYLES[category].dot}`}
                  />
                  {category}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-6">
            {layout.weeks.map((week) => (
              <WeekGrid
                key={week.days[0]?.date ?? "empty"}
                week={week}
                axisStartHour={layout.axisStartHour}
                axisEndHour={layout.axisEndHour}
              />
            ))}
          </div>

          {(layout.offGrid.length > 0 || layout.undated.length > 0) && (
            <section
              aria-label="Not placed on the grid"
              data-testid="calendar-off-grid"
              className="rounded-lg border border-dashed border-slate-300 p-3 text-sm dark:border-slate-700"
            >
              <h3 className="font-medium text-slate-600 dark:text-slate-300">
                Not placed on the grid
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Deadlines without a clock time and subjects without a published{" "}
                {CYCLE} exam date are listed here instead of being placed at a
                guessed position.
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {layout.offGrid.map((item) => (
                  <li
                    key={`${item.entry.key}:offgrid`}
                    className="flex flex-wrap items-baseline gap-x-2 text-slate-700 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 flex-none rounded-full ${
                          CATEGORIES_BY_ID.get(item.entry.subjectId)
                            ? CATEGORY_STYLES[
                                CATEGORIES_BY_ID.get(item.entry.subjectId)!
                              ].dot
                            : "bg-slate-400"
                        }`}
                      />
                      {item.entry.subjectName}
                    </span>
                    <span
                      className={
                        item.reason === "portfolio"
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-slate-600 dark:text-slate-400"
                      }
                    >
                      {offGridLabel(item)}
                    </span>
                  </li>
                ))}
                {layout.undated.map((subject) => (
                  <li
                    key={`${subject.id}:undated`}
                    className="flex flex-wrap items-baseline gap-x-2 text-slate-700 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 flex-none rounded-full ${
                          CATEGORIES_BY_ID.get(subject.id)
                            ? CATEGORY_STYLES[CATEGORIES_BY_ID.get(subject.id)!]
                                .dot
                            : "bg-slate-400"
                        }`}
                      />
                      {subject.name}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">
                      No {CYCLE} exam date
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
