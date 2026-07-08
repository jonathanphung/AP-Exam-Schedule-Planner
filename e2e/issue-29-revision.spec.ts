import { test, expect, type Page } from "@playwright/test";

/**
 * Issue #29 — post-approval revision (Jon's human bounce on PR #35):
 *
 *   1. Sticky sidebar: on desktop the panel pins while the main content
 *      scrolls and stays fully usable at any scroll depth.
 *   2. Collapse icon: the toggle uses the panel-collapse glyph (rectangle
 *      with a left column) instead of the old chevron arrow.
 *   3. Footer row: "Send us Feedback" (left) + GitHub icon (right) on one
 *      row, pinned below the content, in both presentations. House link
 *      rules: text underlines on hover, trailing ↗ / icon never does;
 *      ≥44px touch targets on mobile.
 *
 * All previously-approved #29 behavior is covered by e2e/issue-29-qa.spec.ts
 * and stays binding; this file covers only the bounce deltas.
 */

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 667 };

const SIDEBAR = "aside[data-testid='resources-sidebar']";
const FOOTER = "[data-testid='sidebar-footer']";
const REPO_URL = "https://github.com/jonathanphung/AP-Exam-Planner";

const collapseToggle = (page: Page) =>
  page.getByRole("button", { name: /^(Collapse|Expand) sidebar$/ });
const feedbackLink = (page: Page) =>
  page.locator(FOOTER).getByRole("link", { name: /Send us Feedback/ });
const githubLink = (page: Page) =>
  page.locator(FOOTER).getByRole("link", { name: /GitHub repository/ });

/** Hydration-safe collapse-toggle press (issue-29-qa pattern). */
async function pressToggle(page: Page, expectExpanded: "true" | "false") {
  const toggle = collapseToggle(page);
  await expect(async () => {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", expectExpanded, {
      timeout: 1000,
    });
  }).toPass();
}

// ── 1. Sticky sidebar ───────────────────────────────────────────────────────

test("desktop sidebar is sticky: pinned and usable while the main content scrolls", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/");

  const aside = page.locator(SIDEBAR);
  await expect(aside).toHaveCSS("position", "sticky");

  // Scroll deep into the page (catalog + schedule views make it tall).
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);

  // The panel is still on screen: branding row + toggle within the viewport.
  const toggle = collapseToggle(page);
  await expect(toggle).toBeVisible();
  const box = (await toggle.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(DESKTOP.height);

  // ...and still usable at this scroll depth: collapse + re-expand works.
  await pressToggle(page, "false");
  await pressToggle(page, "true");

  // The footer row is also reachable (panel scrolls internally if needed).
  await feedbackLink(page).scrollIntoViewIfNeeded();
  await expect(feedbackLink(page)).toBeVisible();
});

// ── 2. Panel-collapse glyph ─────────────────────────────────────────────────

test("collapse toggle uses the panel glyph (rect + column divider), not a chevron, in both states", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/");

  const toggle = collapseToggle(page);
  // Expanded state: rectangle outline + column divider present.
  await expect(toggle.locator("svg rect")).toHaveCount(1);
  await expect(toggle.locator("svg path")).toHaveCount(2); // divider + filled column

  // Collapsed state keeps the same glyph family (outline only).
  await pressToggle(page, "false");
  await expect(toggle.locator("svg rect")).toHaveCount(1);
  await expect(toggle.locator("svg path")).toHaveCount(1); // divider only

  // Accessible behavior unchanged.
  await expect(toggle).toHaveAccessibleName("Expand sidebar");
  await pressToggle(page, "true");
  await expect(toggle).toHaveAccessibleName("Collapse sidebar");
});

// ── 3. Footer row ───────────────────────────────────────────────────────────

test("desktop footer row: Send us Feedback left, GitHub icon right, same row, correct targets", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/");

  const feedback = feedbackLink(page);
  const github = githubLink(page);
  await expect(feedback).toBeVisible();
  await expect(github).toBeVisible();

  // Link targets + safe new-tab attributes.
  await expect(feedback).toHaveAttribute("href", `${REPO_URL}/issues/new`);
  await expect(github).toHaveAttribute("href", REPO_URL);
  for (const link of [feedback, github]) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }

  // Same row, feedback left of the GitHub icon.
  const fb = (await feedback.boundingBox())!;
  const gh = (await github.boundingBox())!;
  const fbMid = fb.y + fb.height / 2;
  const ghMid = gh.y + gh.height / 2;
  expect(Math.abs(fbMid - ghMid)).toBeLessThanOrEqual(2);
  expect(fb.x + fb.width).toBeLessThanOrEqual(gh.x);

  // Footer sits below the sections content (last row of the panel).
  const sections = (await page.locator("#sidebar-sections").boundingBox())!;
  expect(fb.y).toBeGreaterThanOrEqual(sections.y + sections.height - 1);

  // Collapsing the desktop column hides the footer with the sections.
  await pressToggle(page, "false");
  await expect(feedback).toBeHidden();
  await expect(github).toBeHidden();
});

test("footer hover: feedback text underlines, trailing ↗ and GitHub icon do not", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/");

  const feedback = feedbackLink(page);
  await feedback.hover();

  const textDecoration = (locator: ReturnType<Page["locator"]>) =>
    locator.evaluate((el) => getComputedStyle(el).textDecorationLine);

  const label = feedback.locator("span", { hasText: "Send us Feedback" });
  const arrow = feedback.locator("span[aria-hidden='true']");
  expect(await textDecoration(label)).toContain("underline");
  expect(await textDecoration(arrow)).not.toContain("underline");

  const github = githubLink(page);
  await github.hover();
  expect(await textDecoration(github)).not.toContain("underline");
});

test("mobile footer row: present in the disclosure card with ≥44px touch targets", async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await page.goto("/");

  const feedback = feedbackLink(page);
  const github = githubLink(page);
  await feedback.scrollIntoViewIfNeeded();
  await expect(feedback).toBeVisible();
  await expect(github).toBeVisible();

  // One row inside the sidebar card, footer below the disclosures.
  const card = (await page.locator(SIDEBAR).boundingBox())!;
  const fb = (await feedback.boundingBox())!;
  const gh = (await github.boundingBox())!;
  expect(fb.y).toBeGreaterThanOrEqual(card.y);
  expect(Math.abs(fb.y + fb.height / 2 - (gh.y + gh.height / 2))).toBeLessThanOrEqual(2);

  // ≥44px touch targets.
  expect(fb.height).toBeGreaterThanOrEqual(44);
  expect(gh.height).toBeGreaterThanOrEqual(44);
  expect(gh.width).toBeGreaterThanOrEqual(44);

  // No horizontal overflow introduced at 375px.
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
});
