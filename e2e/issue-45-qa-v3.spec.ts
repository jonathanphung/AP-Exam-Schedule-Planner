import { test, expect, type Locator, type Page } from "@playwright/test";
import { pressViewChip } from "./support/view-chip";

/**
 * super-board QA (issue #45, v3 — rebuild after the statistics.frqType bounce).
 *
 * History: v1 fixed seven wrong question counts; v2 (after the totalMinutes
 * bounce) corrected four language-exam durations to 150 and reverted two false
 * "pending" overwrites to 120. The Orchestrator's third bounce found the last
 * false pending: `statistics.format.frqType` had been set to "pending" even
 * though BOTH College Board pages publish the Section-II composition. Commit
 * 50f225c set it to the sourced string
 *   "3 multi-part questions + 1 inference question (hypothesis test or
 *    confidence interval)"
 * (AP Central "Question 3: Inference (Hypothesis Test or Confidence Interval)"
 * + three multi-focus/multi-part questions; AP Students the same as multi-part
 * questions). This v3 supersedes v2, whose statistics case asserted a "pending"
 * frqType badge that no longer renders.
 *
 * The exam-details popup, the mobile Tier-2 details, and the calendar event
 * popup all render the SAME `InfoPanel`, so proving the values on the catalog
 * popup at desktop + mobile covers the first two surfaces directly; a
 * calendar-popup test covers the third.
 *
 * Screenshots land in docs/super-board/runs/issue-45-qa-v3/ and are committed
 * to the issue branch so they render inline on the issue / PR. Every value
 * asserted here is the College Board published figure recorded verbatim in
 * docs/super-board/research/collegeboard-2026/<id>.json (post-171cb15) and
 * src/data/sources.md.
 */

const EVIDENCE_DIR = "docs/super-board/runs/issue-45-qa-v3";

const viewports = [
  { name: "desktop", width: 1920, height: 1080 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 375, height: 667 },
] as const;

// ---- InfoPanel (catalog popup) locators — mirror e2e/issue-6 ---------------
const infoButton = (page: Page, name: string) =>
  page.getByRole("button", { name: `View exam details for ${name}` });
const expandButton = (page: Page, name: string) =>
  page.getByRole("button", { name: `Show exam dates for ${name}` });
const dialog = (page: Page) => page.getByRole("dialog");
/** <dd> value for a labelled row inside the panel's description list. */
const rowValue = (page: Page, label: string): Locator =>
  dialog(page).locator("dl > div").filter({ hasText: label }).locator("dd");

/** Reveal a subject's Tier-1 panel and open its exam-details dialog (Tier 2). */
async function openCatalogInfo(page: Page, name: string) {
  await expandButton(page, name).click();
  await infoButton(page, name).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText(name);
}

/**
 * The seven corrected subjects. `mcq`/`frq` are the published counts; `length`
 * is `formatMinutes(totalMinutes)` — French/German/Italian/Spanish are the
 * corrected 150 -> "2 h 30 min", Chinese/Japanese the reverted 120 -> "2 h",
 * Statistics the unchanged 180 -> "3 h". `frqType` is now a sourced string for
 * every one of the seven (no pending badge should render for any of them).
 */
const CORRECTED = [
  {
    name: "AP Statistics",
    mcq: "42",
    frq: "4",
    length: "3 h",
    // The bounce fix: a published composition, never a pending badge.
    frqType: "3 multi-part questions + 1 inference question (hypothesis test or confidence interval)",
  },
  {
    name: "AP French Language and Culture",
    mcq: "55",
    frq: "3",
    length: "2 h 30 min",
    frqType: "1 written task + 2 spoken tasks",
  },
  {
    name: "AP German Language and Culture",
    mcq: "55",
    frq: "3",
    length: "2 h 30 min",
    frqType: "1 written task + 2 spoken tasks",
  },
  {
    name: "AP Italian Language and Culture",
    mcq: "55",
    frq: "3",
    length: "2 h 30 min",
    frqType: "1 written task + 2 spoken tasks",
  },
  {
    name: "AP Spanish Language and Culture",
    mcq: "55",
    frq: "3",
    length: "2 h 30 min",
    frqType: "1 written task + 2 spoken tasks",
  },
  {
    name: "AP Chinese Language and Culture",
    mcq: "55",
    frq: "4",
    length: "2 h",
    frqType: "2 written tasks + 2 spoken tasks",
  },
  {
    name: "AP Japanese Language and Culture",
    mcq: "55",
    frq: "4",
    length: "2 h",
    frqType: "2 written tasks + 2 spoken tasks",
  },
] as const;

test.describe("issue #45 — corrected counts + durations + statistics frqType render in InfoPanel", () => {
  test("AC5 — all seven subjects' catalog exam-details popup shows the corrected counts, frqType, and length; none pending", async ({
    page,
  }) => {
    await page.goto("/");

    for (const s of CORRECTED) {
      await openCatalogInfo(page, s.name);

      await expect(rowValue(page, "Multiple choice"), `${s.name} MCQ`).toContainText(
        `${s.mcq} questions`,
      );
      await expect(rowValue(page, "Free response"), `${s.name} FRQ`).toContainText(
        `${s.frq} questions`,
      );
      // Every one of the seven now publishes an frqType composition — a real
      // string, never the muted "pending" badge.
      await expect(
        rowValue(page, "Free response"),
        `${s.name} frqType`,
      ).toContainText(s.frqType);
      await expect(
        rowValue(page, "Free response").getByText("pending", { exact: true }),
        `${s.name} frqType must not be pending`,
      ).toHaveCount(0);
      await expect(rowValue(page, "Exam length"), `${s.name} length`).toHaveText(
        s.length,
      );
      // No stray "pending" duration anywhere in the dialog.
      await expect(
        rowValue(page, "Exam length").getByText("pending"),
        `${s.name} length must not be pending`,
      ).toHaveCount(0);

      await page.getByRole("button", { name: "Close" }).click();
      await expect(dialog(page)).toHaveCount(0);
    }
  });

  // The headline of this pass: AP Statistics' Section-II composition renders as
  // the sourced string, with each published term present and the dropped
  // "investigative task" absent.
  test("AC5 — AP Statistics frqType shows the sourced Section-II composition (no investigative task, no pending)", async ({
    page,
  }) => {
    await page.goto("/");
    await openCatalogInfo(page, "AP Statistics");
    const frq = rowValue(page, "Free response");
    await expect(frq).toContainText("4 questions");
    await expect(frq).toContainText("multi-part");
    await expect(frq).toContainText("inference");
    await expect(frq).toContainText("hypothesis test or confidence interval");
    await expect(frq.getByText("investigative")).toHaveCount(0);
    await expect(frq.getByText("pending", { exact: true })).toHaveCount(0);
  });

  // Visual evidence at the three standard viewports. Statistics is the headline
  // fix of THIS pass (frqType pending -> sourced composition); French is the
  // headline duration fix of the prior pass (180 -> 150 = "3 h" -> "2 h 30 min").
  // Mobile 375x667 is the "Tier-2 details" surface the ticket names explicitly.
  for (const vp of viewports) {
    test(`AC5 evidence — AP Statistics exam-details popup (${vp.name} ${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await openCatalogInfo(page, "AP Statistics");
      await expect(rowValue(page, "Multiple choice")).toContainText("42 questions");
      await expect(rowValue(page, "Free response")).toContainText("4 questions");
      await expect(rowValue(page, "Free response")).toContainText(
        "3 multi-part questions + 1 inference question (hypothesis test or confidence interval)",
      );
      await expect(rowValue(page, "Exam length")).toHaveText("3 h");
      await dialog(page).screenshot({
        path: `${EVIDENCE_DIR}/catalog-statistics-${vp.name}.png`,
      });
    });

    test(`AC5 evidence — AP French exam-details popup (${vp.name} ${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await openCatalogInfo(page, "AP French Language and Culture");
      await expect(rowValue(page, "Multiple choice")).toContainText("55 questions");
      await expect(rowValue(page, "Free response")).toContainText("3 questions");
      await expect(rowValue(page, "Exam length")).toHaveText("2 h 30 min");
      await dialog(page).screenshot({
        path: `${EVIDENCE_DIR}/catalog-french-${vp.name}.png`,
      });
    });
  }

  // Third surface: the calendar event popup. Same InfoPanel, so proving French
  // renders "2 h 30 min" here confirms the corrected duration flows to every
  // surface. Select only French (no slot conflict -> clicking the block opens
  // details directly, not the conflict dialog).
  test("AC5 evidence — AP French calendar event popup renders the corrected 2 h 30 min", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");

    // Select French from the catalog.
    const frenchCard = page
      .locator('section[aria-label="Subject catalog"] ul > li button[aria-pressed]')
      .filter({ hasText: "AP French Language and Culture" })
      .first();
    await frenchCard.click();
    await expect(frenchCard).toHaveAttribute("aria-pressed", "true");

    // Switch to the calendar and page forward until French's block appears.
    await pressViewChip(page, "Calendar");
    const block = page.locator(
      '[data-testid="calendar-block"][data-subject-id="french-language-and-culture"]',
    );
    const nextWeek = page.getByRole("button", { name: /^Next week/ });
    for (let guard = 0; guard < 8 && (await block.count()) === 0; guard += 1) {
      await nextWeek.click();
    }
    await expect(block, "French calendar block not found in any week").toHaveCount(1);
    await block.scrollIntoViewIfNeeded();
    await block.click();

    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toContainText("AP French Language and Culture");
    await expect(rowValue(page, "Multiple choice")).toContainText("55 questions");
    await expect(rowValue(page, "Free response")).toContainText("3 questions");
    await expect(rowValue(page, "Exam length")).toHaveText("2 h 30 min");
    await dialog(page).screenshot({
      path: `${EVIDENCE_DIR}/calendar-french-desktop.png`,
    });
  });
});
