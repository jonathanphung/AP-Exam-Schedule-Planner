import { describe, expect, it } from "vitest";
import ICAL from "ical.js";
import apData from "../data/ap-2026.json";
import type { ApDataset } from "../data/schema";
import type { SlotResolution } from "./conflicts";
import { buildIcsCalendar, type SessionStartTimes } from "./ics";

/**
 * super-board QA (issue #7, Tester lane) — AC2/AC3/AC5 against the REAL dataset.
 *
 * The builder's `ics.test.ts` proves the generator with synthetic fixtures. This
 * QA spec closes the remaining gap: it drives `buildIcsCalendar` with the actual
 * shipped `ap-2026.json` — real subject names, the real `sessionStartTimes`
 * metadata, and a real same-slot collision resolved through the real
 * `resolveSlots` logic — then parses the output with ical.js. That guarantees the
 * feature works on the data the app ships with, not just on lab fixtures.
 *
 * Fixture selection (all real):
 *   - AP Biology (2026-05-04 AM) + AP Latin (2026-05-04 AM) share a slot → a
 *     genuine conflict; the resolution keeps Biology, so Latin exports at its
 *     real late-testing slot (2026-05-18 PM).
 *   - AP Seminar has BOTH a sit-down exam (2026-05-11 PM) and a portfolio
 *     deadline (2026-04-30) → an exam VEVENT and a portfolio VEVENT.
 *   - AP Cybersecurity (Career Kickstart, id "cybersecurity") has neither an
 *     exam nor a portfolio → contributes no event.
 */

const dataset = apData as unknown as ApDataset;
const SUBJECTS = dataset.subjects;
const SESSION_START: SessionStartTimes = dataset.sessionStartTimes;

// Fixed clock so DTSTAMP is deterministic (AC4 already covered; here it just
// keeps the parse round-trip reproducible).
const FIXED_NOW = new Date(Date.UTC(2026, 6, 5, 13, 30, 0));

const SELECTED = ["biology", "latin", "seminar", "cybersecurity"];

// Keep Biology at 2026-05-04 AM; Latin is bumped to its real late slot.
const KEEP_BIOLOGY: SlotResolution = {
  date: "2026-05-04",
  session: "AM",
  keeperId: "biology",
  memberIds: ["biology", "latin"],
};

function uid(component: ICAL.Component, id: string): ICAL.Component | undefined {
  return component
    .getAllSubcomponents("vevent")
    .find((v) => v.getFirstPropertyValue("uid") === id);
}

describe("issue #7 QA — ICS export against the shipped ap-2026.json", () => {
  const ics = buildIcsCalendar(
    SUBJECTS,
    SELECTED,
    [KEEP_BIOLOGY],
    SESSION_START,
    FIXED_NOW,
  );

  it("the fixture ids resolve to real dataset subjects (guards against a data rename)", () => {
    for (const id of ["biology", "latin", "seminar"]) {
      expect(SUBJECTS.some((s) => s.id === id)).toBe(true);
    }
  });

  it("AC5 — parses with ical.js and yields exactly the expected event count", () => {
    expect(() => ICAL.parse(ics)).not.toThrow();
    const vcal = new ICAL.Component(ICAL.parse(ics));
    const vevents = vcal.getAllSubcomponents("vevent");
    // biology exam + latin exam + seminar exam + seminar portfolio = 4.
    // cybersecurity (no May 2026 exam, no portfolio) contributes 0.
    expect(vevents.length).toBe(4);
  });

  it("AC2 — the kept exam uses the regular AM slot as floating local time", () => {
    const vcal = new ICAL.Component(ICAL.parse(ics));
    const bio = uid(vcal, "biology-exam@ap-exam-planner");
    expect(bio).toBeDefined();
    // 2026-05-04 + 8 a.m. → 20260504T080000, and NO trailing Z (floating).
    const raw = ics.replace(/\r\n /g, "");
    expect(raw).toContain("DTSTART:20260504T080000");
    expect(raw).not.toMatch(/DTSTART:\d{8}T\d{6}Z/);
    // issue #38 — the session suffix is dropped (AM/PM is implicit in DTSTART).
    expect(String(bio?.getFirstPropertyValue("summary"))).toBe(
      "AP Biology exam",
    );
  });

  it("issue #38 — the kept exam carries a DTEND and a sections[] timing-breakdown DESCRIPTION", () => {
    const raw = ics.replace(/\r\n /g, "");
    // Biology: 2026-05-04 08:00 + published 180 + 30-min setup = 11:30, floating.
    expect(raw).toContain("DTEND:20260504T113000");
    expect(raw).not.toMatch(/DTEND:\d{8}T\d{6}Z/);
    // Published section rows come from format.sections[] (the #44 model):
    // dataset section names + questions | minutes | weight, verbatim.
    expect(raw).toContain(
      "Multiple Choice: 60 Questions | 90 Minutes | 50% of Score",
    );
    expect(raw).toContain(
      "Free Response: 6 Questions | 90 Minutes | 50% of Score",
    );
    // issue #38 A/B — published total phrased as hours-and-minutes, +30 setup
    // merged into the same row as OUR allowance.
    expect(raw).toContain(
      "Total Length: 3 hours (+ 30 minutes for exam setup time)",
    );
  });

  it("issue #38 — a subject with no multiple-choice section (AP Seminar) has no MCQ row", () => {
    const vcal = new ICAL.Component(ICAL.parse(ics));
    const seminar = uid(vcal, "seminar-exam@ap-exam-planner");
    expect(seminar).toBeDefined();
    const description = String(seminar?.getFirstPropertyValue("description"));
    // Seminar's published sections are its two end-of-course components — the
    // rows are exactly those, in dataset order…
    expect(description).toContain(
      "End-of-Course Exam – Short-Answer Section: 3 Questions | 30 Minutes | 13.5% of Score",
    );
    expect(description).toContain(
      "End-of-Course Exam – Essay Section: 1 Question | 90 Minutes | 31.5% of Score",
    );
    expect(description).toContain(
      "Total Length: 2 hours (+ 30 minutes for exam setup time)",
    );
    // …and an exam that lacks a section simply has no row for it: no
    // multiple-choice line, and never a fabricated "0" row (issue #38 C5).
    expect(description).not.toContain("Multiple Choice");
    expect(description).not.toContain(": 0 Questions");
  });

  it("AC2 — the moved exam exports at its RESOLVED late slot, not its regular slot", () => {
    const raw = ics.replace(/\r\n /g, "");
    // Latin was bumped to its real late-testing slot 2026-05-18 PM (12 p.m.).
    expect(raw).toContain("DTSTART:20260518T120000");
    // It must NOT still be sitting at the regular 2026-05-04 AM Latin slot.
    const vcal = new ICAL.Component(ICAL.parse(ics));
    const latin = uid(vcal, "latin-exam@ap-exam-planner");
    expect(String(latin?.getFirstPropertyValue("dtstart"))).toContain(
      "2026-05-18",
    );
  });

  it("AC3 — the portfolio subject gets an all-day DATE VEVENT on its deadline", () => {
    const raw = ics.replace(/\r\n /g, "");
    expect(raw).toContain("DTSTART;VALUE=DATE:20260430");
    const vcal = new ICAL.Component(ICAL.parse(ics));
    const portfolio = uid(vcal, "seminar-portfolio@ap-exam-planner");
    expect(portfolio).toBeDefined();
    expect(String(portfolio?.getFirstPropertyValue("summary"))).toBe(
      "AP Seminar portfolio due",
    );
  });
});
