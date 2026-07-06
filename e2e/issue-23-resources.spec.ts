import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * super-board QA (issue #23) — Resources page of curated official College Board links.
 *
 * One observable assertion per acceptance-criterion clause:
 *   AC1 — grouped headings + real anchors with descriptive text (never "click here").
 *   AC2 — every link is a real https collegeboard.org URL; no placeholder/# hrefs.
 *   AC3 — links open in a new tab (target=_blank + rel=noopener noreferrer) with a
 *         visible ↗ and an assistive-tech "(opens in a new tab)" hint.
 *   AC4 — reachable from the home page's primary nav without breaking the
 *         single-page planner flow.
 *   AC5 — the "Not affiliated with College Board" footer notice stays visible.
 *   AC6 — cycle-labeled links read the cycle from apData.cycle (not hardcoded).
 *   AC7 — accessible + responsive at 375 / 1024 / 1920 px, no horizontal overflow,
 *         keyboard-focusable links.
 */

const REPO_ROOT = resolve(__dirname, "..");
const CYCLE = (
  JSON.parse(
    readFileSync(resolve(REPO_ROOT, "src/data/ap-2026.json"), "utf8"),
  ) as { cycle: string }
).cycle;

const GROUP_HEADINGS = ["Exam logistics", "Scores", "Planning & deadlines"];

// ── AC1: grouped headings + descriptive anchors ─────────────────────────────
test("AC1 — grouped headings with real, descriptively-labeled anchors", async ({
  page,
}) => {
  await page.goto("/resources");

  await expect(
    page.getByRole("heading", { level: 1, name: "Resources" }),
  ).toBeVisible();

  for (const heading of GROUP_HEADINGS) {
    await expect(
      page.getByRole("heading", { level: 2, name: heading }),
    ).toBeVisible();
  }

  const links = page.locator("main a[target='_blank']");
  const count = await links.count();
  expect(count, "expected several curated resource links").toBeGreaterThanOrEqual(6);

  for (let i = 0; i < count; i++) {
    const text = (await links.nth(i).innerText()).trim();
    expect(text.length).toBeGreaterThan(3);
    expect(text.toLowerCase()).not.toMatch(/click here|read more|learn more/);
  }
});

// ── AC2: every href is a real official collegeboard.org URL ─────────────────
test("AC2 — every resource link is a real https collegeboard.org URL, no placeholders", async ({
  page,
}) => {
  await page.goto("/resources");

  const hrefs = await page.locator("main a[target='_blank']").evaluateAll(
    (els) => els.map((el) => (el as HTMLAnchorElement).getAttribute("href") ?? ""),
  );

  expect(hrefs.length).toBeGreaterThanOrEqual(6);
  for (const href of hrefs) {
    expect(href).not.toBe("#");
    expect(href.startsWith("https://"), `not https: ${href}`).toBe(true);
    const host = new URL(href).hostname;
    expect(host.endsWith("collegeboard.org"), `not collegeboard.org: ${href}`).toBe(
      true,
    );
    expect(href.toLowerCase()).not.toMatch(/example\.|localhost|placeholder|todo|tbd/);
  }
  // No duplicate links.
  expect(new Set(hrefs).size).toBe(hrefs.length);
});

// ── AC3: new-tab semantics + external-link affordance ───────────────────────
test("AC3 — links open in a new tab with rel=noopener noreferrer and an accessible ↗", async ({
  page,
}) => {
  await page.goto("/resources");

  const links = page.locator("main a[target='_blank']");
  const count = await links.count();

  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    await expect(link).toHaveAttribute("target", "_blank");
    const rel = (await link.getAttribute("rel")) ?? "";
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");

    // Visible external-link indicator ↗ present in the rendered text.
    await expect(link).toContainText("↗");

    // The indicator is decorative (aria-hidden) and the new-tab hint is
    // conveyed to assistive tech via visually-hidden text.
    await expect(link.locator("[aria-hidden='true']")).toBeVisible();
    await expect(
      link.getByText("(opens in a new tab)", { exact: false }),
    ).toHaveCount(1);

    // Accessible name includes the new-tab hint (screen readers announce it).
    const accName = await link.evaluate((el) => el.textContent ?? "");
    expect(accName.toLowerCase()).toContain("opens in a new tab");
  }
});

// ── AC4: reachable from primary nav; single-page flow intact ────────────────
test("AC4 — reachable from the home page primary nav without breaking the planner", async ({
  page,
}) => {
  await page.goto("/");

  // Home page still renders the single-page planner (catalog + schedule).
  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "AP Exam Planner" }),
  ).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Primary" });
  const resourcesLink = nav.getByRole("link", { name: /resources/i });
  await expect(resourcesLink).toBeVisible();

  await resourcesLink.click();
  await expect(page).toHaveURL(/\/resources$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Resources" }),
  ).toBeVisible();

  // A way back to the planner exists (does not trap the user off the SPA flow).
  const backLink = page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: /AP Exam Planner/i });
  await expect(backLink).toBeVisible();
  await backLink.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "AP Exam Planner" })).toBeVisible();
});

// ── AC5: non-affiliation footer notice stays visible ────────────────────────
test("AC5 — the non-affiliation footer notice is present on the Resources page", async ({
  page,
}) => {
  await page.goto("/resources");
  const footer = page.locator('footer[data-testid="site-footer"]');
  await expect(footer).toBeVisible();
  await expect(
    footer.getByText("Not affiliated with College Board.", { exact: false }),
  ).toBeVisible();
});

// ── AC6: cycle-labeled link derives from apData.cycle ───────────────────────
test("AC6 — cycle-labeled links read the cycle from the dataset metadata", async ({
  page,
}) => {
  await page.goto("/resources");
  // The exam-dates and late-testing links are labeled with the dataset cycle.
  const cycleLinks = page.locator("main a[target='_blank']", {
    hasText: `${CYCLE} AP`,
  });
  expect(await cycleLinks.count()).toBeGreaterThanOrEqual(1);
  await expect(cycleLinks.first()).toContainText(CYCLE);
});

// ── AC7: accessible + responsive, no horizontal overflow ────────────────────
const viewports = [
  { name: "desktop", width: 1920, height: 1080 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 375, height: 667 },
] as const;

for (const vp of viewports) {
  test(`AC7 — no horizontal overflow and keyboard-focusable links (${vp.name} ${vp.width}x${vp.height})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/resources", { waitUntil: "networkidle" });

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(
      scrollWidth,
      `Horizontal overflow at ${vp.width}px: scrollWidth=${scrollWidth}`,
    ).toBeLessThanOrEqual(vp.width + 1);

    // First resource link is keyboard-focusable (real anchor, receives focus).
    const firstLink = page.locator("main a[target='_blank']").first();
    await firstLink.focus();
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return {
        tag: el?.tagName.toLowerCase() ?? "",
        target: el?.getAttribute("target") ?? "",
      };
    });
    expect(focused.tag).toBe("a");
    expect(focused.target).toBe("_blank");
  });
}

// ── Clean render (no console/page errors) ───────────────────────────────────
test("Resources page renders without console or page errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.goto("/resources");
  await expect(page.getByRole("heading", { level: 1, name: "Resources" })).toBeVisible();

  expect(pageErrors, `page errors: ${pageErrors.join(", ")}`).toEqual([]);
  const meaningful = consoleErrors.filter((t) => !/favicon/i.test(t));
  expect(meaningful, `console errors: ${meaningful.join(", ")}`).toEqual([]);
});
