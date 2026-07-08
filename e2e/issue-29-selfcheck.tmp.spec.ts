import { test, expect, type Page } from "@playwright/test";

/**
 * TEMPORARY builder self-check for issue #29 — NOT committed. The QA lane
 * authors the real issue-29 spec; this file only lets the Builder verify the
 * ACs end-to-end before handing off.
 */

const SIDEBAR = "aside[data-testid='resources-sidebar']";
const RESOURCE_LINKS = `${SIDEBAR} a[target='_blank']`;
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 667 };

async function openMobileSection(page: Page, name: RegExp) {
  const toggle = page.getByRole("button", { name });
  if ((await toggle.isVisible()) && (await toggle.getAttribute("aria-expanded")) === "false") {
    await toggle.click();
  }
}

test("links fit on one line, no truncation, hover underline excludes ↗ (desktop)", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/");
  const links = page.locator(RESOURCE_LINKS);
  const count = await links.count();
  expect(count).toBeGreaterThanOrEqual(8);
  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    const fit = await link.evaluate((el) => {
      const label = el.querySelector("span") as HTMLElement;
      const style = getComputedStyle(label);
      return {
        scrollWidth: label.scrollWidth,
        clientWidth: label.clientWidth,
        lineHeight: parseFloat(style.lineHeight),
        height: label.getBoundingClientRect().height,
      };
    });
    expect(fit.scrollWidth, `label ${i} truncated`).toBeLessThanOrEqual(fit.clientWidth);
    expect(fit.height, `label ${i} wrapped`).toBeLessThan(fit.lineHeight * 1.5);
  }
  // Hover underline on the label, never the ↗.
  const first = links.first();
  await first.hover();
  const deco = await first.evaluate((el) => {
    const [label, arrow] = Array.from(el.querySelectorAll("span"));
    return {
      label: getComputedStyle(label as HTMLElement).textDecorationLine,
      arrow: getComputedStyle(arrow as HTMLElement).textDecorationLine,
    };
  });
  expect(deco.label).toContain("underline");
  expect(deco.arrow).not.toContain("underline");
});

test("links fit on one line on mobile too", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto("/");
  await openMobileSection(page, /^resources$/i);
  const links = page.locator(RESOURCE_LINKS);
  const count = await links.count();
  for (let i = 0; i < count; i++) {
    const fit = await links.nth(i).evaluate((el) => {
      const label = el.querySelector("span") as HTMLElement;
      return { scrollWidth: label.scrollWidth, clientWidth: label.clientWidth };
    });
    expect(fit.scrollWidth, `label ${i} truncated on mobile`).toBeLessThanOrEqual(fit.clientWidth);
  }
});

test("collapse toggle hides sidebar, widens main, persists across reload", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/");
  const aside = page.locator(SIDEBAR);
  const main = page.getByRole("main", { name: "Exam planner" });
  const wideBefore = (await main.boundingBox())!.width;
  const toggle = page.getByRole("button", { name: "Collapse sidebar" });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
  const asideAfter = (await aside.boundingBox())!.width;
  expect(asideAfter).toBeLessThan(80);
  const wideAfter = (await main.boundingBox())!.width;
  expect(wideAfter).toBeGreaterThan(wideBefore + 100);
  // My Schedules + Resources content hidden when collapsed.
  await expect(page.locator(RESOURCE_LINKS).first()).toBeHidden();
  // Remembered across reload.
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("apx.sidebar.v1"))).toBe("collapsed");
  // h1 still the document's single h1.
  expect(await page.locator("h1").count()).toBe(1);
  // Expand again.
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.locator(RESOURCE_LINKS).first()).toBeVisible();
});

test("create/switch/rename/delete schedules; per-schedule selection isolation; export follows active", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/");
  const group = page.getByRole("radiogroup", { name: "My schedules" });
  await expect(group.getByRole("radio", { name: "Schedule 1" })).toBeChecked();

  // Select a subject in Schedule 1 (first catalog card checkbox-style button).
  const bio = page.getByRole("button", { name: /^AP Biology/ }).first();
  await bio.click();
  await expect(bio).toHaveAttribute("aria-pressed", "true");
  const exportBtn = page.getByTestId("export-ics-button");
  await expect(exportBtn).toBeEnabled();

  // Create Schedule 2 — becomes active, starts empty.
  await page.getByRole("button", { name: "New schedule" }).click();
  const s2 = group.getByRole("radio", { name: "Schedule 2" });
  await expect(s2).toBeChecked();
  await expect(bio).toHaveAttribute("aria-pressed", "false");
  await expect(exportBtn).toBeDisabled();

  // Switch back — Schedule 1's plan returns immediately.
  await group.getByRole("radio", { name: "Schedule 1" }).click();
  await expect(bio).toHaveAttribute("aria-pressed", "true");
  await expect(exportBtn).toBeEnabled();

  // Keyboard: ArrowDown moves AND selects.
  await group.getByRole("radio", { name: "Schedule 1" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(s2).toBeChecked();
  await expect(s2).toBeFocused();

  // Rename Schedule 2 inline.
  await page.getByRole("button", { name: "Rename Schedule 2" }).click();
  const input = page.getByLabel("New name for Schedule 2");
  await expect(input).toBeFocused();
  await input.fill("ambitious draft");
  await input.press("Enter");
  await expect(group.getByRole("radio", { name: "ambitious draft" })).toBeChecked();
  await expect(page.getByRole("button", { name: "Rename ambitious draft" })).toBeFocused();

  // Delete it with confirm; Schedule 1 becomes active again.
  await page.getByRole("button", { name: "Delete ambitious draft" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await dialog.getByRole("button", { name: "Delete schedule" }).click();
  await expect(group.getByRole("radio", { name: "Schedule 1" })).toBeChecked();
  await expect(bio).toHaveAttribute("aria-pressed", "true");

  // Last remaining schedule cannot be deleted.
  await expect(page.getByRole("button", { name: "Delete Schedule 1" })).toBeDisabled();

  // State survives reload.
  await page.reload();
  await expect(group.getByRole("radio", { name: "Schedule 1" })).toBeChecked();
  await expect(bio).toHaveAttribute("aria-pressed", "true");
});

test("migration: legacy apx.selection.v1 + apx.resolutions.v1 adopted as Schedule 1", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("apx.selection.v1", JSON.stringify(["biology"]));
  });
  await page.setViewportSize(DESKTOP);
  await page.goto("/");
  const group = page.getByRole("radiogroup", { name: "My schedules" });
  await expect(group.getByRole("radio", { name: "Schedule 1" })).toBeChecked();
  const bio = page.getByRole("button", { name: /^AP Biology/ }).first();
  await expect(bio).toHaveAttribute("aria-pressed", "true");
  const stored = await page.evaluate(() => window.localStorage.getItem("apx.schedules.v1"));
  expect(stored).toContain("biology");
});

test("mobile: My Schedules disclosure switches schedules", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /^my schedules$/i });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  const group = page.getByRole("radiogroup", { name: "My schedules" });
  await expect(group.getByRole("radio", { name: "Schedule 1" })).toBeChecked();
  await page.getByRole("button", { name: "New schedule" }).click();
  await expect(group.getByRole("radio", { name: "Schedule 2" })).toBeChecked();
  // No horizontal overflow with the panel open.
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(376);
});
