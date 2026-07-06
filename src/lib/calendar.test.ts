import { describe, expect, it } from "vitest";
import { LATE_TESTING_WINDOW, REGULAR_WINDOWS, type Category } from "../data/schema";
import {
  buildCalendarLayout,
  calendarWeeks,
  enumerateDates,
  hourLabel,
  monthDayLabel,
  parseStartHour,
  weekdayLabel,
  weekRangeLabel,
  NOMINAL_BLOCK_HOURS,
} from "./calendar";
import type { Schedule, ScheduleEntry } from "./schedule";

/**
 * Unit tests for the pure calendar-grid layout logic (issue #19).
 * Fixtures are synthetic Schedule shapes so every branch (exam placement,
 * lane splitting, portfolio/off-grid routing, unparseable times) is exercised
 * regardless of the real dataset's contents.
 */

const START_TIMES = { AM: "8 a.m. local time", PM: "12 p.m. local time" };

function examEntry(
  subjectId: string,
  date: string,
  session: "AM" | "PM",
  movedToLate = false,
): ScheduleEntry {
  return {
    key: `${subjectId}:exam`,
    subjectId,
    subjectName: `AP ${subjectId}`,
    kind: "exam",
    date,
    session,
    note: null,
    movedToLate,
  };
}

function portfolioEntry(subjectId: string, date: string): ScheduleEntry {
  return {
    key: `${subjectId}:portfolio`,
    subjectId,
    subjectName: `AP ${subjectId}`,
    kind: "portfolio",
    date,
    session: null,
    note: "fixture note",
    movedToLate: false,
  };
}

function scheduleOf(entries: ScheduleEntry[], undated: Schedule["undated"] = []): Schedule {
  const byDate = new Map<string, ScheduleEntry[]>();
  for (const entry of entries) {
    const group = byDate.get(entry.date);
    if (group) group.push(entry);
    else byDate.set(entry.date, [entry]);
  }
  return {
    groups: Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, group]) => ({ date, entries: group })),
    undated,
  };
}

const CATEGORIES_BY_ID: ReadonlyMap<string, Category> = new Map([
  ["bio", "STEM"],
  ["euro", "Humanities"],
  ["latin", "Languages"],
]);

describe("enumerateDates", () => {
  it("returns every date from start to end inclusive", () => {
    expect(enumerateDates("2026-05-04", "2026-05-08")).toEqual([
      "2026-05-04",
      "2026-05-05",
      "2026-05-06",
      "2026-05-07",
      "2026-05-08",
    ]);
  });

  it("handles a single-day range and month boundaries", () => {
    expect(enumerateDates("2026-05-04", "2026-05-04")).toEqual(["2026-05-04"]);
    expect(enumerateDates("2026-04-30", "2026-05-01")).toEqual([
      "2026-04-30",
      "2026-05-01",
    ]);
  });
});

describe("calendarWeeks", () => {
  it("covers every day of the published windows, regular weeks first, late last", () => {
    const weeks = calendarWeeks();
    expect(weeks).toHaveLength(REGULAR_WINDOWS.length + 1);
    REGULAR_WINDOWS.forEach((window, i) => {
      expect(weeks[i].late).toBe(false);
      expect(weeks[i].days[0]).toBe(window.start);
      expect(weeks[i].days[weeks[i].days.length - 1]).toBe(window.end);
    });
    const late = weeks[weeks.length - 1];
    expect(late.late).toBe(true);
    expect(late.days[0]).toBe(LATE_TESTING_WINDOW.start);
    expect(late.days[late.days.length - 1]).toBe(LATE_TESTING_WINDOW.end);
  });
});

describe("parseStartHour", () => {
  it("parses the dataset's published session labels", () => {
    expect(parseStartHour(START_TIMES.AM)).toBe(8);
    expect(parseStartHour(START_TIMES.PM)).toBe(12);
  });

  it("handles minutes, casing, and 12 a.m.", () => {
    expect(parseStartHour("1:30 p.m.")).toBe(13.5);
    expect(parseStartHour("9 A.M.")).toBe(9);
    expect(parseStartHour("12 a.m. midnight")).toBe(0);
  });

  it("returns null for unparseable labels (never guesses)", () => {
    expect(parseStartHour("pending")).toBeNull();
    expect(parseStartHour("morning session")).toBeNull();
    expect(parseStartHour("25 p.m.")).toBeNull();
  });
});

describe("buildCalendarLayout", () => {
  it("places exams on their effective date at the parsed session start hour", () => {
    const layout = buildCalendarLayout(
      scheduleOf([
        examEntry("bio", "2026-05-04", "AM"),
        examEntry("euro", "2026-05-11", "PM"),
      ]),
      START_TIMES,
      CATEGORIES_BY_ID,
    );

    const may4 = layout.weeks[0].days.find((d) => d.date === "2026-05-04")!;
    expect(may4.blocks).toHaveLength(1);
    expect(may4.blocks[0]).toMatchObject({
      subjectId: "bio",
      category: "STEM",
      session: "AM",
      startHour: 8,
      startLabel: START_TIMES.AM,
    });

    const may11 = layout.weeks[1].days.find((d) => d.date === "2026-05-11")!;
    expect(may11.blocks[0]).toMatchObject({
      subjectId: "euro",
      category: "Humanities",
      startHour: 12,
    });
    expect(layout.offGrid).toHaveLength(0);
  });

  it("renders a moved exam in the late-testing week, not its regular slot", () => {
    const layout = buildCalendarLayout(
      scheduleOf([examEntry("latin", "2026-05-19", "PM", true)]),
      START_TIMES,
      CATEGORIES_BY_ID,
    );
    const lateWeek = layout.weeks[layout.weeks.length - 1];
    const may19 = lateWeek.days.find((d) => d.date === "2026-05-19")!;
    expect(may19.blocks[0]).toMatchObject({
      subjectId: "latin",
      movedToLate: true,
    });
  });

  it("splits same-day same-start blocks into side-by-side lanes", () => {
    const layout = buildCalendarLayout(
      scheduleOf([
        examEntry("euro", "2026-05-04", "AM"),
        examEntry("bio", "2026-05-04", "AM"),
        examEntry("latin", "2026-05-04", "PM"),
      ]),
      START_TIMES,
      CATEGORIES_BY_ID,
    );
    const may4 = layout.weeks[0].days.find((d) => d.date === "2026-05-04")!;
    const am = may4.blocks.filter((b) => b.startHour === 8);
    // Sorted by name: AP bio before AP euro.
    expect(am.map((b) => [b.subjectId, b.laneIndex, b.laneCount])).toEqual([
      ["bio", 0, 2],
      ["euro", 1, 2],
    ]);
    const pm = may4.blocks.find((b) => b.startHour === 12)!;
    expect([pm.laneIndex, pm.laneCount]).toEqual([0, 1]);
  });

  it("routes portfolio deadlines off-grid instead of guessing a time", () => {
    const layout = buildCalendarLayout(
      scheduleOf([portfolioEntry("bio", "2026-04-30")]),
      START_TIMES,
      CATEGORIES_BY_ID,
    );
    expect(layout.weeks.flatMap((w) => w.days).flatMap((d) => d.blocks)).toHaveLength(0);
    expect(layout.offGrid).toEqual([
      expect.objectContaining({ reason: "portfolio" }),
    ]);
  });

  it("routes exams with unparseable session labels off-grid", () => {
    const layout = buildCalendarLayout(
      scheduleOf([examEntry("bio", "2026-05-04", "AM")]),
      { AM: "pending", PM: START_TIMES.PM },
      CATEGORIES_BY_ID,
    );
    expect(layout.offGrid).toEqual([
      expect.objectContaining({ reason: "no-published-time" }),
    ]);
  });

  it("routes exam dates outside every published window off-grid", () => {
    const layout = buildCalendarLayout(
      scheduleOf([examEntry("bio", "2026-05-09", "AM")]),
      START_TIMES,
      CATEGORIES_BY_ID,
    );
    expect(layout.offGrid).toEqual([
      expect.objectContaining({ reason: "outside-windows" }),
    ]);
  });

  it("derives the axis from the parsed session starts plus the nominal height", () => {
    const layout = buildCalendarLayout(scheduleOf([]), START_TIMES, CATEGORIES_BY_ID);
    expect(layout.axisStartHour).toBe(8);
    expect(layout.axisEndHour).toBe(12 + NOMINAL_BLOCK_HOURS + 1);
  });

  it("passes undated subjects through", () => {
    const layout = buildCalendarLayout(
      scheduleOf([], [{ id: "cyber", name: "AP Cybersecurity", reason: "2027" }]),
      START_TIMES,
      CATEGORIES_BY_ID,
    );
    expect(layout.undated).toEqual([
      { id: "cyber", name: "AP Cybersecurity", reason: "2027" },
    ]);
  });
});

describe("labels", () => {
  it("formats weekday and month-day headers without timezone day-shift", () => {
    expect(weekdayLabel("2026-05-04")).toBe("MON");
    expect(monthDayLabel("2026-05-04")).toBe("May 4");
  });

  it("formats week ranges", () => {
    expect(weekRangeLabel(["2026-05-04", "2026-05-05", "2026-05-08"])).toBe(
      "May 4 – May 8",
    );
    expect(weekRangeLabel(["2026-05-04"])).toBe("May 4");
    expect(weekRangeLabel([])).toBe("");
  });

  it("formats axis hour ticks", () => {
    expect(hourLabel(8)).toBe("8 AM");
    expect(hourLabel(12)).toBe("12 PM");
    expect(hourLabel(15)).toBe("3 PM");
    expect(hourLabel(0)).toBe("12 AM");
  });
});
