import { test, expect, type Page } from "@playwright/test";
import apData from "../src/data/ap-2026.json";
import {
  LATE_TESTING_WINDOW,
  REGULAR_WINDOWS,
} from "../src/data/schema";

/**
 * super-board QA (issue #19) — week-paged calendar grid view for selected
 * exams (v2 design after the human bounce: one week at a time with visible
 * Previous/Next pager buttons; the pager replaces month scrolling).
 *
 * One observable, browser-level test per acceptance criterion, plus pager
 * coverage (week 1 → next → late-testing week, indicator text, a11y
 * semantics, default page) and screenshot capture at the three standard
 * super-board viewports (desktop 1920x1080, tablet 1024x768, mobile 375x667).
 * Screenshots land in the run evidence folder and are committed to the issue
 * branch so they render inline on the issue / PR.
 *
 * Dataset-driven fixtures (asserted from the shipped JSON, never hardcoded
 * beyond ids):
 *   - AP Biology        STEM        2026-05-04 AM → late 2026-05-20 PM
 *   - AP Latin          Languages   2026-05-04 AM (collides with Biology)
 *   - AP Chemistry      STEM        2026-05-05 AM (same category as Biology)
 *   - AP Spanish Literature and Culture  Languages  2026-05-13 PM (conflict-free)
 *   - AP Seminar        Humanities  2026-05-11 PM + portfolio 2026-04-30
 *   - AP Drawing        Arts        portfolio-only, deadline 2026-05-08
 *   - AP Cybersecurity  Career Kickstart — no exam, no portfolio (undated)
 *
 * Fixture rule: tests that seed selections via localStorage use CONFLICT-FREE
 * sets — an unresolved same-slot conflict opens issue #5's modal dialog
 * (deliberately blocking, Escape-dismissable), which would intercept the
 * view-switcher click. The conflict pair (Biology+Latin) is only used in AC3,
 * which tests exactly that path through the UI.
 */

// Env-overridable so a re-verification pass writes a fresh evidence set
// instead of rewriting a prior run's committed screenshots.
const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR ?? "docs/super-board/runs/issue-19-qa-v2";

const SELECTION_KEY = "apx.selection.v1";

type Subject = {
  id: string;
  name: string;
  category: string;
  exam: { date: string; session: "AM" | "PM" } | null;
  lateTesting: { date: string; session: "AM" | "PM" } | null;
  portfolio: { deadline: string } | null;
};

const DATASET = apData as {
  cycle: string;
  sessionStartTimes: { AM: string; PM: string };
  subjects: Subject[];
};
const byId = (id: string): Subject => {
  const s = DATASET.subjects.find((x) => x.id === id);
  if (!s) throw new Error(`fixture subject missing from dataset: ${id}`);
  return s;
};

const BIOLOGY = byId("biology");
const LATIN = byId("latin");
const CHEMISTRY = byId("chemistry");
const SPANISH_LIT = byId("spanish-literature-and-culture");
const SEMINAR = byId("seminar");
const DRAWING = byId("drawing");
const CYBER = byId("cybersecurity");

// Guard the fixture assumptions against dataset edits — if these ever fail,
// the spec's scenario (not the app) needs re-picking.
if (
  BIOLOGY.exam!.date !== LATIN.exam!.date ||
  BIOLOGY.exam!.session !== LATIN.exam!.session
)
  throw new Error("fixture drift: biology/latin no longer share a slot");
if (BIOLOGY.lateTesting!.date !== "2026-05-20")
  throw new Error("fixture drift: biology late-testing date moved");
if (BIOLOGY.category !== CHEMISTRY.category)
  throw new Error("fixture drift: biology/chemistry categories differ");
if (CYBER.exam !== null || CYBER.portfolio !== null)
  throw new Error("fixture drift: cybersecurity now has a dated entry");
if (REGULAR_WINDOWS.length + 1 < 3)
  throw new Error(
    "fixture drift: fewer than 3 testing weeks — pager tests assume week 3 exists",
  );
{
  // The seeded (non-AC3) sets must stay conflict-free — see fixture rule above.
  const slots = [BIOLOGY, CHEMISTRY, SPANISH_LIT, SEMINAR].map(
    (s) => `${s.exam!.date}:${s.exam!.session}`,
  );
  if (new Set(slots).size !== slots.length)
    throw new Error("fixture drift: seeded subjects now share a slot");
  if (SPANISH_LIT.category !== "Languages")
    throw new Error("fixture drift: spanish-literature category changed");
}

// ---------------------------------------------------------------------------
// Locators
// ---------------------------------------------------------------------------

const switcher = (page: Page) =>
  page.getByRole("group", { name: "Schedule view" });
const listChip = (page: Page) =>
  switcher(page).getByRole("button", { name: "My Schedule" });
const calendarChip = (page: Page) =>
  switcher(page).getByRole("button", { name: "Calendar" });
const calendarView = (page: Page) => page.getByTestId("calendar-view");
const weekSections = (page: Page) =>
  calendarView(page).locator(
    'section[aria-label^="Week of"], section[aria-label^="Late-testing week"]',
  );
const blocks = (page: Page) => page.getByTestId("calendar-block");
const blockFor = (page: Page, subjectId: string) =>
  page.locator(
    `[data-testid="calendar-block"][data-subject-id="${subjectId}"]`,
  );
const offGrid = (page: Page) => page.getByTestId("calendar-off-grid");

// Pager (v2 design): Previous/Next buttons + aria-live position indicator.
// Accessible names start with "Previous week" / "Next week"; when other weeks
// hold exams the name carries a count suffix, so match by prefix.
const pager = (page: Page) => page.getByTestId("calendar-pager");
const prevButton = (page: Page) =>
  pager(page).getByRole("button", { name: /^Previous week/ });
const nextButton = (page: Page) =>
  pager(page).getByRole("button", { name: /^Next week/ });
const indicator = (page: Page) =>
  page.getByTestId("calendar-week-indicator");

/** Page forward until the indicator reads "Week <n> of ...". */
async function gotoWeek(page: Page, n: number) {
  for (let guard = 0; guard < 10; guard += 1) {
    const text = (await indicator(page).textContent()) ?? "";
    const match = /Week (\d+) of/.exec(text);
    if (!match) throw new Error(`no week indicator found: "${text}"`);
    const current = Number(match[1]);
    if (current === n) return;
    if (current < n) await nextButton(page).click();
    else await prevButton(page).click();
  }
  throw new Error(`could not reach week ${n}`);
}

// Schema-derived week fixtures (never hardcoded): regular windows in order,
// then the late-testing window — mirrors `calendarWeeks()`.
const WINDOWS = [
  ...REGULAR_WINDOWS.map((w) => ({ ...w, late: false })),
  { ...LATE_TESTING_WINDOW, late: true },
];
const WEEK_COUNT = WINDOWS.length;

/** Every ISO date from start to end inclusive (UTC math, no DST drift). */
function datesOf(w: { start: string; end: string }): string[] {
  const out: string[] = [];
  for (
    let ms = Date.parse(`${w.start}T00:00:00Z`);
    ms <= Date.parse(`${w.end}T00:00:00Z`);
    ms += 86_400_000
  )
    out.push(new Date(ms).toISOString().slice(0, 10));
  return out;
}

/** "MON" / "May 4" labels for a floating ISO date (mirrors the app's labels). */
function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "short" })
    .format(new Date(y, m - 1, d))
    .toUpperCase();
}
function monthDayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(y, m - 1, d));
}
function rangeOf(w: { start: string; end: string }): string {
  return `${monthDayOf(w.start)} – ${monthDayOf(w.end)}`;
}

/** 0-based index of the window containing an ISO date, or -1. */
function weekIndexOf(iso: string): number {
  return WINDOWS.findIndex((w) => iso >= w.start && iso <= w.end);
}

const catalog = (page: Page) =>
  page.locator('section[aria-label="Subject catalog"]');
const card = (page: Page, name: string) =>
  catalog(page)
    .locator("ul > li button[aria-pressed]")
    .filter({ hasText: name });

async function select(page: Page, name: string) {
  const c = card(page, name);
  await c.scrollIntoViewIfNeeded();
  await c.click();
  await expect(c).toHaveAttribute("aria-pressed", "true");
}

/** Seed the selection store before any app script runs (persisted-load path). */
async function seedSelection(page: Page, ids: string[]) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [SELECTION_KEY, JSON.stringify(ids)] as const,
  );
}

async function openCalendar(page: Page) {
  await calendarChip(page).click();
  await expect(calendarView(page)).toBeVisible();
}

// ---------------------------------------------------------------------------
// AC1 — view switcher: keyboard-operable, obvious selected state, defaults
//       to the list view so existing behavior is unchanged on first load.
// ---------------------------------------------------------------------------

test("AC1 — switcher defaults to list, toggles by keyboard, exposes pressed state", async ({
  page,
}) => {
  // Reduced-motion-safe (issue #8 a11y bar): the switcher must work
  // identically with animations disabled.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");

  // Default = list view: My Schedule pressed, calendar not mounted.
  await expect(listChip(page)).toHaveAttribute("aria-pressed", "true");
  await expect(calendarChip(page)).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("heading", { level: 2, name: "My Schedule" }),
  ).toBeVisible();
  await expect(calendarView(page)).toHaveCount(0);

  // Obvious selected state: the pressed chip paints a different background
  // than the unpressed one (blue-600 vs white), not just an ARIA flag.
  const bg = (locator: ReturnType<typeof listChip>) =>
    locator.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await bg(listChip(page))).not.toBe(await bg(calendarChip(page)));

  // Keyboard: focus the Calendar chip and activate with Enter.
  await calendarChip(page).focus();
  // Focus-visible ring (a11y bar): keyboard focus paints a ring shadow.
  await page.keyboard.press("Enter");
  await expect(calendarChip(page)).toHaveAttribute("aria-pressed", "true");
  await expect(listChip(page)).toHaveAttribute("aria-pressed", "false");
  await expect(calendarView(page)).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "My Schedule" }),
  ).toHaveCount(0);

  await page.screenshot({
    path: `${EVIDENCE_DIR}/ac1-switcher-calendar-active-desktop.png`,
  });

  // Space toggles back to the list view.
  await listChip(page).focus();
  await page.keyboard.press("Space");
  await expect(listChip(page)).toHaveAttribute("aria-pressed", "true");
  await expect(calendarView(page)).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// AC2 (v2) — time-grid pages ONE week at a time: hourly axis, dated day
//       headers, every published window reachable via the Previous/Next
//       pager (which replaces month scrolling), ends disabled (no wrap).
// ---------------------------------------------------------------------------

test("AC2 — pager walks every published week one grid at a time with dated headers and an hourly axis", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await seedSelection(page, [BIOLOGY.id, SEMINAR.id]);
  await page.goto("/");
  await openCalendar(page);

  // Biology sits in the first window, so the default page is week 1: the
  // Previous button is disabled at the start end (documented no-wrap choice).
  await expect(indicator(page)).toContainText(`Week 1 of ${WEEK_COUNT}`);
  await expect(prevButton(page)).toBeDisabled();
  await expect(nextButton(page)).toBeEnabled();

  // Walk forward through EVERY published window — regular weeks in order,
  // then the late-testing week — asserting exactly one week grid at a time.
  for (const [index, window] of WINDOWS.entries()) {
    if (index > 0) await nextButton(page).click();

    // Indicator: schema-derived range + position ("May 4 – May 8 · Week 1 of 3").
    await expect(indicator(page)).toContainText(rangeOf(window));
    await expect(indicator(page)).toContainText(
      `Week ${index + 1} of ${WEEK_COUNT}`,
    );

    // Exactly ONE week section mounted — the month never stacks vertically.
    await expect(weekSections(page)).toHaveCount(1);
    const section = weekSections(page).first();
    await expect(section).toBeInViewport();

    // The late-testing week is visibly badged; regular weeks are not.
    await expect(
      indicator(page).getByText("Late testing", { exact: true }),
    ).toHaveCount(window.late ? 1 : 0);

    // Every day of the window renders a dated column header ("MON · May 4").
    const days = datesOf(window);
    for (const iso of days) {
      const header = section
        .locator("p")
        .filter({ hasText: weekdayOf(iso) })
        .filter({ hasText: monthDayOf(iso) });
      await expect(header).toHaveCount(1);
    }
    const headerCells = section
      .locator("p")
      .filter({ hasText: /^(MON|TUE|WED|THU|FRI|SAT|SUN)\s*·/ });
    await expect(headerCells).toHaveCount(days.length);

    // Hourly axis on every page: both dataset session anchors are labeled
    // (8 AM / 12 PM per the shipped sessionStartTimes) plus a later tick
    // proving the axis is hour-by-hour, not a two-band AM/PM strip.
    await expect(section.getByText("8 AM", { exact: true })).toBeVisible();
    await expect(section.getByText("12 PM", { exact: true })).toBeVisible();
    await expect(section.getByText("2 PM", { exact: true })).toBeVisible();

    if (index === 0) {
      await page.screenshot({
        path: `${EVIDENCE_DIR}/ac2-week1-grid-desktop.png`,
        fullPage: true,
      });
    }
  }

  // Far end: Next is disabled on the last (late-testing) week — no wrap.
  await expect(nextButton(page)).toBeDisabled();
  await expect(prevButton(page)).toBeEnabled();
  await page.screenshot({
    path: `${EVIDENCE_DIR}/ac2-late-week-grid-desktop.png`,
    fullPage: true,
  });

  // And back: Previous returns to week 1 where Previous disables again.
  await gotoWeek(page, 1);
  await expect(indicator(page)).toContainText(`Week 1 of ${WEEK_COUNT}`);
  await expect(prevButton(page)).toBeDisabled();
});

// ---------------------------------------------------------------------------
// AC3 — blocks read through the conflict-resolution layer: a moved exam
//       renders at its effective late-testing slot, matching the list view.
// ---------------------------------------------------------------------------

test("AC3 — resolved conflict places the moved exam at its late-testing slot in both views", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");

  // Drive the real resolution flow in the list view (dialogs live there):
  // Biology and Latin share 2026-05-04 AM; keeping Latin moves Biology to
  // its official late slot (2026-05-20 PM per the dataset).
  await select(page, BIOLOGY.name);
  await select(page, LATIN.name);
  const prompt = page.getByTestId("conflict-prompt");
  await expect(prompt).toBeVisible();

  // UNRESOLVED state first: dismiss the modal (Escape, per issue #5) and
  // check the calendar renders the still-conflicting exams side by side in
  // the one real slot they share — no position invented for either.
  await page.keyboard.press("Escape");
  await openCalendar(page);
  const may4Exams = calendarView(page).locator(
    'ul[aria-label*="May 4"] [data-testid="calendar-block"]',
  );
  await expect(may4Exams).toHaveCount(2);
  const [bioBox, latinBox] = await Promise.all([
    blockFor(page, BIOLOGY.id).boundingBox(),
    blockFor(page, LATIN.id).boundingBox(),
  ]);
  expect(bioBox && latinBox).toBeTruthy();
  // Same start time → same top edge; lane-split → non-overlapping x ranges.
  expect(Math.abs(bioBox!.y - latinBox!.y)).toBeLessThanOrEqual(1);
  const [left, right] = [bioBox!, latinBox!].sort((a, b) => a.x - b.x);
  expect(left.x + left.width).toBeLessThanOrEqual(right.x + 1);
  await page.screenshot({
    path: `${EVIDENCE_DIR}/ac3-unresolved-lane-split-desktop.png`,
  });

  // Now resolve: back to the list view, keep Latin at the regular time.
  await listChip(page).click();
  await expect(prompt.first()).toBeVisible();
  await prompt
    .getByRole("button", { name: `Keep ${LATIN.name} at the regular time` })
    .first()
    .click();

  // List view truth: Biology now sits under the late date's group.
  const listSection = page.locator('section[aria-label="My schedule"]');
  await expect(
    listSection
      .locator("ol > li")
      .filter({ hasText: "May 20" })
      .filter({ hasText: BIOLOGY.name }),
  ).toHaveCount(1);

  await openCalendar(page);

  // Reopening the calendar re-derives the default page: Latin (the keeper)
  // is now the earliest placed exam, so the view opens on week 1 with Latin
  // at its regular AM slot — and Biology's block is NOT on this page.
  await expect(indicator(page)).toContainText(`Week 1 of ${WEEK_COUNT}`);
  const latinBlock = blockFor(page, LATIN.id);
  await expect(latinBlock).toHaveCount(1);
  await expect(latinBlock).toContainText(DATASET.sessionStartTimes.AM);
  await expect(blockFor(page, BIOLOGY.id)).toHaveCount(0);

  // Page to the late-testing week (the pager, not scrolling, reaches it).
  await gotoWeek(page, WEEK_COUNT);
  const lateSection = calendarView(page).locator(
    'section[aria-label^="Late-testing week"]',
  );
  await expect(lateSection).toBeVisible();

  // Calendar truth: exactly one Biology block, inside the late-testing week,
  // in the May 20 column, at the PM session start read from the dataset.
  const bioBlock = blockFor(page, BIOLOGY.id);
  await expect(bioBlock).toHaveCount(1);
  await expect(lateSection.getByTestId("calendar-block")).toHaveCount(1);
  await expect(bioBlock).toContainText(BIOLOGY.name);
  await expect(bioBlock).toContainText(DATASET.sessionStartTimes.PM);
  await expect(bioBlock).toContainText("Moved to late testing");
  // ...and inside the May 20 day column specifically.
  const may20Exams = lateSection.locator(
    'ul[aria-label*="May 20"] [data-testid="calendar-block"]',
  );
  await expect(may20Exams).toHaveCount(1);
  // Latin stayed behind on week 1 — one week mounted at a time.
  await expect(blockFor(page, LATIN.id)).toHaveCount(0);

  await page.screenshot({
    path: `${EVIDENCE_DIR}/ac3-moved-to-late-desktop.png`,
  });
});

// ---------------------------------------------------------------------------
// AC4 — blocks are color-coded by category and show name + start time.
// ---------------------------------------------------------------------------

test("AC4 — blocks are category-colored with a legend, showing subject name and start time", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await seedSelection(page, [
    BIOLOGY.id, // STEM
    CHEMISTRY.id, // STEM — same category, must share Biology's color
    SPANISH_LIT.id, // Languages
    SEMINAR.id, // Humanities
  ]);
  await page.goto("/");
  await openCalendar(page);

  // The fixtures span two testing weeks; the view shows one week at a time,
  // so visit each subject's week via the pager and collect its rendered
  // background along the way (computed styles, not class names).
  const fixtures = [BIOLOGY, CHEMISTRY, SPANISH_LIT, SEMINAR];
  const bgBySubject = new Map<string, string>();
  for (const s of fixtures) {
    await gotoWeek(page, weekIndexOf(s.exam!.date) + 1);
    const b = blockFor(page, s.id);
    await expect(b).toHaveCount(1);
    // Every block shows its subject name + its session start label.
    await expect(b).toContainText(s.name);
    await expect(b).toContainText(DATASET.sessionStartTimes[s.exam!.session]);
    bgBySubject.set(
      s.id,
      await b.evaluate((el) => getComputedStyle(el).backgroundColor),
    );
  }

  // Color-coded by category: same category → same background, different
  // category → different background — consistent across pager pages.
  const bg = (id: string) => bgBySubject.get(id)!;
  expect(bg(CHEMISTRY.id)).toBe(bg(BIOLOGY.id)); // STEM = STEM
  expect(bg(SPANISH_LIT.id)).not.toBe(bg(BIOLOGY.id)); // Languages ≠ STEM
  expect(bg(SEMINAR.id)).not.toBe(bg(BIOLOGY.id)); // Humanities ≠ STEM
  expect(bg(SEMINAR.id)).not.toBe(bg(SPANISH_LIT.id));

  // Pager nice-to-have (bounce item 5): with two exams in a later week, the
  // Next button carries an exam-count badge, folded into its accessible name.
  await gotoWeek(page, 1);
  await expect(nextButton(page)).toHaveAccessibleName(
    "Next week (2 exams in later weeks)",
  );
  await expect(prevButton(page)).toHaveAccessibleName("Previous week");

  // Legend lists exactly the categories in use.
  const legend = page.getByRole("list", { name: "Category color legend" });
  await expect(legend.getByText("STEM")).toBeVisible();
  await expect(legend.getByText("Languages")).toBeVisible();
  await expect(legend.getByText("Humanities")).toBeVisible();
  await expect(legend.locator("li")).toHaveCount(3);

  await page.screenshot({
    path: `${EVIDENCE_DIR}/ac4-category-colors-desktop.png`,
    fullPage: true,
  });
});

// ---------------------------------------------------------------------------
// AC5 — portfolio deadlines and undated subjects are LISTED beside the grid,
//       never positioned at an invented time (PRD §7.5).
// ---------------------------------------------------------------------------

test("AC5 — portfolio deadlines and undated subjects land in the off-grid list, never on the grid", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await seedSelection(page, [SEMINAR.id, DRAWING.id, CYBER.id]);
  await page.goto("/");
  await openCalendar(page);

  // Default page (bounce item 5): Seminar's exam is the only placed block and
  // sits in the second window, so the calendar opens directly on that week —
  // off-grid-only subjects (Drawing/Cyber) never influence the default.
  await expect(indicator(page)).toContainText(
    `Week ${weekIndexOf(SEMINAR.exam!.date) + 1} of ${WEEK_COUNT}`,
  );

  const section = offGrid(page);
  await expect(section).toBeVisible();
  await expect(
    section.getByRole("heading", { name: "Not placed on the grid" }),
  ).toBeVisible();

  // Drawing: portfolio-only → listed with its deadline, no grid block.
  await expect(
    section.locator("li").filter({ hasText: DRAWING.name }),
  ).toContainText("Portfolio due");
  await expect(
    section.locator("li").filter({ hasText: DRAWING.name }),
  ).toContainText("May 8, 2026");
  await expect(blockFor(page, DRAWING.id)).toHaveCount(0);

  // Seminar: its exam IS on the grid, but its portfolio deadline (a date
  // with no clock time) is listed, not positioned.
  await expect(blockFor(page, SEMINAR.id)).toHaveCount(1);
  await expect(
    section.locator("li").filter({ hasText: SEMINAR.name }),
  ).toContainText("Portfolio due");

  // Cybersecurity: no May 2026 exam at all → listed as undated, no block.
  await expect(
    section.locator("li").filter({ hasText: CYBER.name }),
  ).toContainText(`No ${DATASET.cycle} exam date`);
  await expect(blockFor(page, CYBER.id)).toHaveCount(0);

  // Exactly one block total (Seminar's exam) — nothing was guessed onto
  // the grid for the timeless/undated entries.
  await expect(blocks(page)).toHaveCount(1);

  await section.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${EVIDENCE_DIR}/ac5-offgrid-list-desktop.png`,
  });
});

// ---------------------------------------------------------------------------
// AC6 — zero selections shows an empty-state hint, not a blank grid.
// ---------------------------------------------------------------------------

test("AC6 — empty selection renders a hint instead of a blank grid", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await openCalendar(page);

  await expect(
    calendarView(page).getByText(
      "Select subjects above to build your calendar",
    ),
  ).toBeVisible();
  await expect(weekSections(page)).toHaveCount(0);
  await expect(blocks(page)).toHaveCount(0);
  // The pager only exists alongside the grid — the empty state replaces both.
  await expect(pager(page)).toHaveCount(0);

  await page.screenshot({
    path: `${EVIDENCE_DIR}/ac6-empty-state-desktop.png`,
  });
});

// ---------------------------------------------------------------------------
// AC7 — banner states the cycle, read from dataset metadata.
// ---------------------------------------------------------------------------

test("AC7 — banner names the dataset cycle", async ({ page }) => {
  await page.goto("/");
  await openCalendar(page);

  // Asserted against the JSON the app ships — if the dataset cycle changes,
  // this expectation changes with it (nothing hardcoded to "May 2026").
  await expect(
    calendarView(page).getByText(
      `Dates reflect the ${DATASET.cycle} AP exam cycle.`,
    ),
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// AC8 — usable at 375 / 1024 / 1920: the grid may scroll inside its own
//       container, the page body never scrolls horizontally; zero console
//       and page errors at every viewport (issue #8 bar).
// ---------------------------------------------------------------------------

const viewports = [
  { name: "desktop", width: 1920, height: 1080 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 375, height: 667 },
] as const;

for (const vp of viewports) {
  test(`AC8 — calendar usable at ${vp.name} ${vp.width}x${vp.height}: no body h-scroll, grid scrolls internally, no errors`, async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: vp.width, height: vp.height });
    await seedSelection(page, [
      BIOLOGY.id,
      CHEMISTRY.id,
      SPANISH_LIT.id,
      SEMINAR.id,
      DRAWING.id,
      CYBER.id,
    ]);
    await page.goto("/");
    await openCalendar(page);
    await expect(blocks(page).first()).toBeVisible();

    // One week at a time, with the pager buttons ALWAYS visible (touch swipe,
    // where offered, is never the only affordance — bounce item 4).
    await expect(weekSections(page)).toHaveCount(1);
    await expect(prevButton(page)).toBeVisible();
    await expect(nextButton(page)).toBeVisible();
    await expect(indicator(page)).toContainText(`of ${WEEK_COUNT}`);

    // Page body NEVER scrolls horizontally.
    const bodyOverflow = await page.evaluate(
      () =>
        Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        ) -
        document.documentElement.clientWidth,
    );
    expect(
      bodyOverflow,
      `page body overflows horizontally by ${bodyOverflow}px`,
    ).toBeLessThanOrEqual(0);

    // The grid's own container is the horizontal scroller when the viewport
    // is narrower than the grid's minimum width (mobile), and needs no
    // scrolling on desktop.
    const gridScroller = calendarView(page)
      .locator("div.overflow-x-auto")
      .first();
    const scroll = await gridScroller.evaluate((el) => ({
      overflowX: getComputedStyle(el).overflowX,
      scrollable: el.scrollWidth > el.clientWidth,
    }));
    expect(scroll.overflowX).toBe("auto");
    if (vp.name === "mobile") {
      expect(
        scroll.scrollable,
        "at 375px the grid should scroll within its own container",
      ).toBe(true);
    }

    await page.screenshot({
      path: `${EVIDENCE_DIR}/${vp.name}.png`,
      fullPage: true,
    });

    const meaningfulErrors = consoleErrors.filter(
      (t) => !/favicon/i.test(t),
    );
    expect(
      pageErrors,
      `Unexpected page errors: ${pageErrors.join(", ")}`,
    ).toEqual([]);
    expect(
      meaningfulErrors,
      `Unexpected console errors: ${meaningfulErrors.join(", ")}`,
    ).toEqual([]);
  });
}

// ---------------------------------------------------------------------------
// AC8 (keyboard) — focus-visible ring on the switcher chips (issue #8 bar).
// ---------------------------------------------------------------------------

test("AC8 — switcher chips paint a focus-visible ring under keyboard focus", async ({
  page,
}) => {
  await page.goto("/");

  // Walk keyboard focus onto the Calendar chip (real Tab traversal, so the
  // browser applies :focus-visible, unlike programmatic .focus()).
  await listChip(page).focus();
  await page.keyboard.press("Tab");
  await expect(calendarChip(page)).toBeFocused();

  const shadow = await calendarChip(page).evaluate(
    (el) => getComputedStyle(el).boxShadow,
  );
  expect(shadow, "keyboard focus should paint a visible ring").not.toBe(
    "none",
  );
});

// ---------------------------------------------------------------------------
// Pager a11y (bounce item 4) — real buttons with accessible labels, fully
// keyboard operable, week changes announced via an aria-live region, and a
// focus-visible ring on the pager buttons; reduced-motion safe throughout.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bounce item 5 (QA-added) — the default page FOLLOWS the live selection
// (first week holding a placed exam) until the student pages manually; after
// a manual page, their position wins and later selection changes never yank
// the view away. Also exercises the issue-notes constraint that the grid
// reacts live to catalog toggles while mounted.
// ---------------------------------------------------------------------------

test("Bounce 5 — default page follows the live selection until the student pages manually", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await seedSelection(page, [SPANISH_LIT.id]);
  await page.goto("/");
  await openCalendar(page);

  const spanishWeek = weekIndexOf(SPANISH_LIT.exam!.date) + 1;
  const bioWeek = weekIndexOf(BIOLOGY.exam!.date) + 1;
  expect(bioWeek, "fixture sanity: biology must sit in an earlier week").toBeLessThan(spanishWeek);

  // Default = the first (here: only) week holding a placed exam — week 2.
  await expect(indicator(page)).toContainText(
    `Week ${spanishWeek} of ${WEEK_COUNT}`,
  );
  await expect(blockFor(page, SPANISH_LIT.id)).toHaveCount(1);

  // Live-toggle an EARLIER-week subject in the catalog while the calendar is
  // mounted (no reload): the grid reacts live and the default page follows
  // back to Biology's week, where its block is now placed.
  await select(page, BIOLOGY.name);
  await expect(indicator(page)).toContainText(
    `Week ${bioWeek} of ${WEEK_COUNT}`,
  );
  await expect(blockFor(page, BIOLOGY.id)).toHaveCount(1);

  // The student pages manually — their position now wins...
  await gotoWeek(page, WEEK_COUNT);
  await expect(indicator(page)).toContainText(
    `Week ${WEEK_COUNT} of ${WEEK_COUNT}`,
  );

  // ...so a further live selection change (Chemistry lands in week 1, not
  // here) must NOT yank the page away from the student's chosen week.
  await select(page, CHEMISTRY.name);
  await expect(card(page, CHEMISTRY.name)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(indicator(page)).toContainText(
    `Week ${WEEK_COUNT} of ${WEEK_COUNT}`,
  );
  await expect(blockFor(page, CHEMISTRY.id)).toHaveCount(0);

  await page.screenshot({
    path: `${EVIDENCE_DIR}/bounce5-default-follows-then-manual-wins-desktop.png`,
  });
});

test("Pager a11y — keyboard-operable buttons with accessible names and an aria-live week announcement", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await seedSelection(page, [BIOLOGY.id]);
  await page.goto("/");
  await openCalendar(page);

  // Real <button>s with the required accessible labels.
  await expect(prevButton(page)).toHaveCount(1);
  await expect(nextButton(page)).toHaveCount(1);
  await expect(prevButton(page)).toHaveAccessibleName(/^Previous week/);
  await expect(nextButton(page)).toHaveAccessibleName(/^Next week/);

  // The position indicator is a polite atomic live region, so week changes
  // are announced to assistive tech without stealing focus.
  await expect(indicator(page)).toHaveAttribute("aria-live", "polite");
  await expect(indicator(page)).toHaveAttribute("aria-atomic", "true");
  await expect(indicator(page)).toContainText(`Week 1 of ${WEEK_COUNT}`);

  // Real Tab traversal reaches the pager: with Previous disabled on week 1
  // (disabled buttons are skipped), the next stop after the Calendar chip is
  // the Next button — and keyboard focus paints a :focus-visible ring.
  await calendarChip(page).focus();
  await page.keyboard.press("Tab");
  await expect(nextButton(page)).toBeFocused();
  const shadow = await nextButton(page).evaluate(
    (el) => getComputedStyle(el).boxShadow,
  );
  expect(shadow, "keyboard focus should paint a visible ring").not.toBe(
    "none",
  );

  // Enter pages forward and the live region reflects the new week.
  await page.keyboard.press("Enter");
  await expect(indicator(page)).toContainText(`Week 2 of ${WEEK_COUNT}`);
  await expect(indicator(page)).toContainText(rangeOf(WINDOWS[1]));
  await expect(prevButton(page)).toBeEnabled();

  // Space works too (native button semantics).
  await nextButton(page).focus();
  await page.keyboard.press("Space");
  await expect(indicator(page)).toContainText(`Week 3 of ${WEEK_COUNT}`);

  // Keyboard paging back via the Previous button.
  await prevButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(indicator(page)).toContainText(`Week 2 of ${WEEK_COUNT}`);

  await page.screenshot({
    path: `${EVIDENCE_DIR}/pager-keyboard-week2-desktop.png`,
  });
});
