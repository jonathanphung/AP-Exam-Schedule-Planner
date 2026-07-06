import {
  LATE_TESTING_WINDOW,
  REGULAR_WINDOWS,
  type Category,
  type Session,
} from "../data/schema";
import type { Schedule, ScheduleEntry, UndatedSubject } from "./schedule";

/**
 * Pure layout logic for the month-calendar grid view (issue #19).
 *
 * Turns the schedule built by `buildSchedule` (which already reads through the
 * conflict-resolution layer, so every exam sits at its *effective* slot) into
 * a week-by-week time-grid layout: dated day columns, an hourly axis, and
 * positioned exam blocks.
 *
 * Design decision (documented per the issue): the dataset publishes session
 * START times only ("8 a.m. local time" / "12 p.m. local time") and no exam
 * durations — durations are not to be invented. We render a full hourly axis
 * (option (a) in the issue) where each exam is a block of FIXED NOMINAL HEIGHT
 * ({@link NOMINAL_BLOCK_HOURS} axis-hours) anchored at its real start time.
 * The nominal height is purely presentational — no end time is ever shown.
 *
 * Data rule (PRD §7.5): nothing here fabricates a date or time. Start hours
 * are parsed from the dataset's `sessionStartTimes` strings; if a label can't
 * be parsed, or an exam's date falls outside every published window, the entry
 * is returned in `offGrid` to be *listed* next to the grid, never guessed onto
 * it. Portfolio deadlines are calendar dates with no clock time, so they are
 * always off-grid entries.
 */

/** Presentational block height in axis-hours (no published durations exist). */
export const NOMINAL_BLOCK_HOURS = 2;

export interface CalendarWeek {
  /** ISO dates of every day in the window, in order (Mon–Fri for 2026). */
  days: string[];
  /** True for the late-testing window (rendered with a distinct header). */
  late: boolean;
}

/** An exam block positioned on the grid. */
export interface CalendarBlock {
  /** Stable React key (`${subjectId}:exam`). */
  key: string;
  subjectId: string;
  subjectName: string;
  /** Subject category (drives the block color); null if the id is unknown. */
  category: Category | null;
  session: Session;
  /** Dataset session-start label, displayed verbatim (e.g. "8 a.m. local time"). */
  startLabel: string;
  /** Parsed start in fractional hours (e.g. 8, 12). Anchor for the block top. */
  startHour: number;
  /** True when a conflict resolution moved this exam to its late-testing slot. */
  movedToLate: boolean;
  /** Horizontal lane when several blocks share one day+start (0-based). */
  laneIndex: number;
  /** Total lanes sharing this block's day+start. */
  laneCount: number;
}

export interface CalendarDay {
  date: string;
  blocks: CalendarBlock[];
}

export interface CalendarWeekLayout {
  late: boolean;
  days: CalendarDay[];
}

/** A schedule entry that must be listed beside the grid, not positioned on it. */
export interface OffGridEntry {
  entry: ScheduleEntry;
  /** Why it isn't on the grid (shown to the student). */
  reason: "portfolio" | "no-published-time" | "outside-windows";
}

export interface CalendarLayout {
  weeks: CalendarWeekLayout[];
  /** First axis hour (inclusive), e.g. 8 → the "8 AM" line. */
  axisStartHour: number;
  /** Last axis hour (exclusive end of the grid), e.g. 15 → grid ends at 3 PM. */
  axisEndHour: number;
  /** Dated entries that cannot be positioned without inventing data. */
  offGrid: OffGridEntry[];
  /** Selected subjects with no dated entry at all (from `Schedule.undated`). */
  undated: UndatedSubject[];
}

/** Enumerate ISO dates from `start` to `end` inclusive (UTC-safe, no DST drift). */
export function enumerateDates(start: string, end: string): string[] {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  const dates: string[] = [];
  for (let ms = startMs; ms <= endMs; ms += 86_400_000) {
    dates.push(new Date(ms).toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Every day of the cycle's published testing windows, week by week:
 * the regular windows (in order) followed by the late-testing window.
 */
export function calendarWeeks(): CalendarWeek[] {
  return [
    ...REGULAR_WINDOWS.map((w) => ({
      days: enumerateDates(w.start, w.end),
      late: false,
    })),
    {
      days: enumerateDates(LATE_TESTING_WINDOW.start, LATE_TESTING_WINDOW.end),
      late: true,
    },
  ];
}

/**
 * Parse the leading clock time of a dataset session label into fractional
 * hours: "8 a.m. local time" → 8, "12 p.m. local time" → 12, "1:30 p.m." →
 * 13.5. Returns `null` when the label doesn't start with a recognizable
 * time — callers must then treat the entry as off-grid, never guess.
 */
export function parseStartHour(label: string): number | null {
  const match = /^\s*(\d{1,2})(?::(\d{2}))?\s*(a|p)\.?m\.?/i.exec(label);
  if (!match) return null;
  let hour = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (hour < 1 || hour > 12 || minutes > 59) return null;
  if (hour === 12) hour = 0; // 12 a.m. → 0, 12 p.m. → 12 (after meridiem add)
  if (match[3].toLowerCase() === "p") hour += 12;
  return hour + minutes / 60;
}

/**
 * Build the full calendar layout from an already-built {@link Schedule}.
 *
 * `sessionStartTimes` is the dataset's `{ AM, PM }` label pair — start hours
 * are parsed from it here, never hardcoded. `categoriesById` maps subject id →
 * category (schedule entries don't carry the category).
 */
export function buildCalendarLayout(
  schedule: Schedule,
  sessionStartTimes: { AM: string; PM: string },
  categoriesById: ReadonlyMap<string, Category>,
): CalendarLayout {
  const weeks = calendarWeeks();
  const gridDates = new Set(weeks.flatMap((w) => w.days));
  const startHours: Record<Session, number | null> = {
    AM: parseStartHour(sessionStartTimes.AM),
    PM: parseStartHour(sessionStartTimes.PM),
  };

  const blocksByDate = new Map<string, CalendarBlock[]>();
  const offGrid: OffGridEntry[] = [];

  for (const group of schedule.groups) {
    for (const entry of group.entries) {
      if (entry.kind === "portfolio") {
        // A portfolio deadline is a calendar date with no clock time — listing
        // it beside the grid is the only placement that invents nothing.
        offGrid.push({ entry, reason: "portfolio" });
        continue;
      }
      const session = entry.session ?? "AM";
      const startHour = startHours[session];
      if (startHour === null) {
        offGrid.push({ entry, reason: "no-published-time" });
        continue;
      }
      if (!gridDates.has(entry.date)) {
        offGrid.push({ entry, reason: "outside-windows" });
        continue;
      }
      const block: CalendarBlock = {
        key: entry.key,
        subjectId: entry.subjectId,
        subjectName: entry.subjectName,
        category: categoriesById.get(entry.subjectId) ?? null,
        session,
        startLabel: sessionStartTimes[session],
        startHour,
        movedToLate: entry.movedToLate,
        laneIndex: 0,
        laneCount: 1,
      };
      const existing = blocksByDate.get(entry.date);
      if (existing) existing.push(block);
      else blocksByDate.set(entry.date, [block]);
    }
  }

  // Assign horizontal lanes: blocks sharing a day + start hour split the
  // column side by side (an unresolved same-slot conflict stays visible as
  // two blocks in one slot, matching the list view's pre-resolution state).
  for (const blocks of blocksByDate.values()) {
    blocks.sort(
      (a, b) =>
        a.startHour - b.startHour ||
        a.subjectName.localeCompare(b.subjectName),
    );
    const byStart = new Map<number, CalendarBlock[]>();
    for (const block of blocks) {
      const lane = byStart.get(block.startHour);
      if (lane) lane.push(block);
      else byStart.set(block.startHour, [block]);
    }
    for (const lane of byStart.values()) {
      lane.forEach((block, index) => {
        block.laneIndex = index;
        block.laneCount = lane.length;
      });
    }
  }

  // Axis range: derived from the parsed session starts so a dataset swap
  // (different published times) re-ranges the axis automatically. The
  // fallback (8–15) only applies when NO session label is parseable — in that
  // state every exam is off-grid and the axis is empty chrome, not data.
  const parsed = [startHours.AM, startHours.PM].filter(
    (h): h is number => h !== null,
  );
  const axisStartHour =
    parsed.length > 0 ? Math.floor(Math.min(...parsed)) : 8;
  const axisEndHour =
    parsed.length > 0
      ? Math.ceil(Math.max(...parsed)) + NOMINAL_BLOCK_HOURS + 1
      : 8 + NOMINAL_BLOCK_HOURS + 1 + 4;

  return {
    weeks: weeks.map((week) => ({
      late: week.late,
      days: week.days.map((date) => ({
        date,
        blocks: blocksByDate.get(date) ?? [],
      })),
    })),
    axisStartHour,
    axisEndHour,
    offGrid,
    undated: schedule.undated,
  };
}

/** "MON" — uppercase short weekday for a floating ISO date (local, no TZ shift). */
export function weekdayLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "short" })
    .format(new Date(year, month - 1, day))
    .toUpperCase();
}

/** "May 4" — short month + day for a floating ISO date (local, no TZ shift). */
export function monthDayLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

/** "May 4 – May 8" — range label for a week's days. */
export function weekRangeLabel(days: readonly string[]): string {
  if (days.length === 0) return "";
  const first = monthDayLabel(days[0]);
  const last = monthDayLabel(days[days.length - 1]);
  return days.length === 1 ? first : `${first} – ${last}`;
}

/** Axis tick label for a fractional hour: 8 → "8 AM", 12 → "12 PM", 15 → "3 PM". */
export function hourLabel(hour: number): string {
  const whole = Math.floor(hour) % 24;
  const meridiem = whole < 12 ? "AM" : "PM";
  const clock = whole % 12 === 0 ? 12 : whole % 12;
  return `${clock} ${meridiem}`;
}
