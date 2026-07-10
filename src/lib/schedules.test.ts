import { describe, expect, it } from "vitest";
import type { SlotResolution } from "./conflicts";
import {
  DEFAULT_SCHEDULE_NAME,
  activeSchedule,
  createDefaultState,
  migrateLegacyState,
  nextScheduleName,
  parseSchedulesState,
  sanitizeResolutions,
  sanitizeSelection,
  withActiveResolutions,
  withActiveSchedule,
  withActiveSelection,
  withScheduleCreated,
  withScheduleDeleted,
  withScheduleRenamed,
  type SchedulesState,
} from "./schedules";

/**
 * Unit tests for the multi-schedule store's pure core (issue #29).
 *
 * The store shell (localStorage read/write, storage events, React hook) is
 * covered by the Playwright suite in a real browser; these tests pin the pure
 * state machine — migration of pre-#29 visitors (an explicit AC), the
 * create/rename/delete/switch transitions, the last-schedule guard, and
 * per-schedule isolation of selection + resolutions.
 */

const RESOLUTION_A: SlotResolution = {
  date: "2026-05-08",
  session: "AM",
  keeperId: "us-history",
  memberIds: ["us-history", "art-history"],
};

const RESOLUTION_B: SlotResolution = {
  date: "2026-05-12",
  session: "PM",
  keeperId: "biology",
  memberIds: ["biology", "chemistry"],
};

describe("migration of pre-#29 visitors (adopt legacy keys as Schedule 1)", () => {
  it("adopts an existing selection and resolutions as 'Schedule 1'", () => {
    const state = migrateLegacyState(
      JSON.stringify(["us-history", "biology"]),
      JSON.stringify([RESOLUTION_A]),
    );
    expect(state.schedules).toHaveLength(1);
    const only = state.schedules[0];
    expect(only.name).toBe(DEFAULT_SCHEDULE_NAME);
    expect(state.activeId).toBe(only.id);
    expect(only.selection).toEqual(["us-history", "biology"]);
    expect(only.resolutions).toEqual([RESOLUTION_A]);
  });

  it("a fresh visitor (no legacy keys) gets one empty 'Schedule 1'", () => {
    const state = migrateLegacyState(null, null);
    expect(state.schedules).toHaveLength(1);
    expect(state.schedules[0].name).toBe(DEFAULT_SCHEDULE_NAME);
    expect(state.schedules[0].selection).toEqual([]);
    expect(state.schedules[0].resolutions).toEqual([]);
  });

  it("corrupt legacy payloads degrade to empty state, never throw", () => {
    const state = migrateLegacyState("{not json", '{"also": "wrong shape"}');
    expect(state.schedules).toHaveLength(1);
    expect(state.schedules[0].selection).toEqual([]);
    expect(state.schedules[0].resolutions).toEqual([]);
  });

  it("sanitizes legacy values with the stores' original rules", () => {
    // Duplicates + non-strings dropped from the selection; malformed and
    // duplicate-slot resolutions dropped (first wins) — the same behavior the
    // pre-#29 stores applied on read.
    expect(sanitizeSelection(["a", "a", 7, "b", null])).toEqual(["a", "b"]);
    const sameSlotAsA: SlotResolution = {
      ...RESOLUTION_A,
      keeperId: "art-history",
    };
    expect(
      sanitizeResolutions([
        RESOLUTION_A,
        sameSlotAsA, // duplicate slot — first wins
        { date: "2026-05-08" }, // malformed
        RESOLUTION_B,
      ]),
    ).toEqual([RESOLUTION_A, RESOLUTION_B]);
  });
});

describe("parseSchedulesState (persisted apx.schedules.v1 payloads)", () => {
  it("round-trips a persisted state", () => {
    const state = withScheduleCreated(
      withActiveSelection(createDefaultState(), ["biology"]),
      "ambitious draft",
    );
    const parsed = parseSchedulesState(
      JSON.stringify({ activeId: state.activeId, schedules: state.schedules }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.activeId).toBe(state.activeId);
    expect(parsed!.schedules.map((s) => s.name)).toEqual([
      "Schedule 1",
      "ambitious draft",
    ]);
    expect(parsed!.schedules[0].selection).toEqual(["biology"]);
  });

  it("returns null for absent/corrupt/shape-less payloads", () => {
    expect(parseSchedulesState(null)).toBeNull();
    expect(parseSchedulesState("")).toBeNull();
    expect(parseSchedulesState("{oops")).toBeNull();
    expect(parseSchedulesState('"a string"')).toBeNull();
    expect(parseSchedulesState('{"schedules": "nope"}')).toBeNull();
    expect(parseSchedulesState('{"schedules": []}')).toBeNull();
    expect(parseSchedulesState('{"schedules": [{"noId": true}]}')).toBeNull();
  });

  it("falls back to the first schedule when activeId is unknown", () => {
    const parsed = parseSchedulesState(
      JSON.stringify({
        activeId: "ghost",
        schedules: [
          { id: "s1", name: "One", selection: [], resolutions: [] },
          { id: "s2", name: "Two", selection: [], resolutions: [] },
        ],
      }),
    );
    expect(parsed!.activeId).toBe("s1");
  });

  it("drops malformed/duplicate schedules and defaults blank names", () => {
    const parsed = parseSchedulesState(
      JSON.stringify({
        activeId: "s1",
        schedules: [
          { id: "s1", name: "One", selection: ["a"], resolutions: [] },
          { id: "s1", name: "duplicate id", selection: [], resolutions: [] },
          "not-an-object",
          { id: "", name: "empty id" },
          { id: "s2", name: "   ", selection: "wrong", resolutions: null },
        ],
      }),
    );
    expect(parsed!.schedules.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(parsed!.schedules[1].name).toBe("Schedule 2"); // blank → default
    expect(parsed!.schedules[1].selection).toEqual([]); // wrong shape → empty
  });
});

describe("create / rename / delete / switch transitions", () => {
  function threeSchedules(): SchedulesState {
    return withScheduleCreated(
      withScheduleCreated(createDefaultState()),
      undefined,
    );
  }

  it("auto-names 'Schedule N' past the highest existing number", () => {
    expect(nextScheduleName([{ name: "Schedule 1" }])).toBe("Schedule 2");
    expect(
      nextScheduleName([{ name: "Schedule 1" }, { name: "Schedule 5" }]),
    ).toBe("Schedule 6");
    // Custom names don't collide with the counter.
    expect(nextScheduleName([{ name: "ambitious draft" }])).toBe("Schedule 1");
  });

  it("creating appends an empty schedule and makes it active", () => {
    const before = withActiveSelection(createDefaultState(), ["biology"]);
    const after = withScheduleCreated(before);
    expect(after.schedules).toHaveLength(2);
    expect(after.schedules.map((s) => s.name)).toEqual([
      "Schedule 1",
      "Schedule 2",
    ]);
    expect(after.activeId).toBe(after.schedules[1].id);
    expect(activeSchedule(after).selection).toEqual([]); // starts empty
  });

  it("renames trim whitespace; blank and unknown-id renames are no-ops", () => {
    const state = createDefaultState();
    const id = state.schedules[0].id;
    expect(
      withScheduleRenamed(state, id, "  ambitious draft  ").schedules[0].name,
    ).toBe("ambitious draft");
    expect(withScheduleRenamed(state, id, "   ")).toBe(state);
    expect(withScheduleRenamed(state, "ghost", "x")).toBe(state);
  });

  it("the last remaining schedule cannot be deleted", () => {
    const state = createDefaultState();
    expect(withScheduleDeleted(state, state.schedules[0].id)).toBe(state);
  });

  it("deleting the active schedule activates its next neighbor", () => {
    const state = threeSchedules(); // active = third
    const [first, second, third] = state.schedules;
    // Delete the active LAST schedule → previous neighbor becomes active.
    const afterLast = withScheduleDeleted(state, third.id);
    expect(afterLast.schedules.map((s) => s.id)).toEqual([first.id, second.id]);
    expect(afterLast.activeId).toBe(second.id);
    // Delete an active FIRST schedule → next neighbor becomes active.
    const activeFirst = withActiveSchedule(state, first.id);
    const afterFirst = withScheduleDeleted(activeFirst, first.id);
    expect(afterFirst.activeId).toBe(second.id);
    // Deleting an inactive schedule leaves the active one alone.
    const afterInactive = withScheduleDeleted(state, first.id);
    expect(afterInactive.activeId).toBe(third.id);
  });

  it("switching to an unknown schedule is a no-op", () => {
    const state = threeSchedules();
    expect(withActiveSchedule(state, "ghost")).toBe(state);
  });
});

describe("per-schedule plan isolation (selection AND resolutions)", () => {
  it("each schedule owns its selection and resolutions; switching never leaks", () => {
    // Schedule 1 with a plan + a conflict resolution…
    let state = withActiveResolutions(
      withActiveSelection(createDefaultState(), ["us-history", "art-history"]),
      [RESOLUTION_A],
    );
    const firstId = state.activeId;

    // …then a brand-new Schedule 2 (active, empty).
    state = withScheduleCreated(state);
    const secondId = state.activeId;
    expect(activeSchedule(state).selection).toEqual([]);
    expect(activeSchedule(state).resolutions).toEqual([]); // no leak in

    // Give Schedule 2 its own plan.
    state = withActiveResolutions(
      withActiveSelection(state, ["biology", "chemistry"]),
      [RESOLUTION_B],
    );

    // Switch back: Schedule 1's plan is exactly as it was left.
    state = withActiveSchedule(state, firstId);
    expect(activeSchedule(state).selection).toEqual([
      "us-history",
      "art-history",
    ]);
    expect(activeSchedule(state).resolutions).toEqual([RESOLUTION_A]);

    // And Schedule 2 kept its own (no leak back).
    state = withActiveSchedule(state, secondId);
    expect(activeSchedule(state).selection).toEqual(["biology", "chemistry"]);
    expect(activeSchedule(state).resolutions).toEqual([RESOLUTION_B]);
  });

  it("clearing the active schedule's resolutions leaves the others intact", () => {
    let state = withActiveResolutions(createDefaultState(), [RESOLUTION_A]);
    const firstId = state.activeId;
    state = withScheduleCreated(state);
    state = withActiveResolutions(state, [RESOLUTION_B]);
    state = withActiveResolutions(state, []); // clear Schedule 2's only
    expect(activeSchedule(state).resolutions).toEqual([]);
    state = withActiveSchedule(state, firstId);
    expect(activeSchedule(state).resolutions).toEqual([RESOLUTION_A]);
  });
});
