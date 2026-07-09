import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * super-board QA (issue #41) — theme toggle (light / dark / system).
 *
 * One observable, browser-level test per acceptance-criterion clause that the
 * unit suite (src/lib/theme.test.ts, the pure core) cannot reach: the DOM /
 * storage shell — pre-paint FOUC prevention, persistence across reload, System
 * following an emulated `prefers-color-scheme` change, the class-based dark
 * strategy actually flipping `dark:` utilities, both sidebar presentations +
 * the collapsed rail, and the #8 accessibility bar (button semantics, live
 * announcement, keyboard, 44px target, decorative icon, axe-clean footer).
 *
 * Test hooks (from the Builder's handoff):
 *   data-testid="theme-toggle"        — the cycling button
 *   data-testid="theme-announcement"  — the polite live region
 *   data-testid="sidebar-footer"      — the footer row it lives in
 *   apx.theme.v1                      — the localStorage key
 */

const THEME_KEY = "apx.theme.v1";
const EVIDENCE_DIR = "docs/super-board/runs/issue-41-qa-v1";

// Exact label strings the component renders (kept in lockstep with
// ThemeToggle.tsx's LABELS map); the accessible name is
// `Theme: ${label}. Change theme.` and the announcement is `Theme: ${label}.`.
const LABEL = {
  light: "Light",
  dark: "Dark",
  system: "System (follows your device)",
} as const;

const toggle = (page: Page) => page.getByTestId("theme-toggle");
const announcement = (page: Page) => page.getByTestId("theme-announcement");
const githubLink = (page: Page) =>
  page.getByRole("link", { name: /GitHub repository/ });

type HtmlState = { dark: boolean; colorScheme: string; bodyBg: string };
const htmlState = (page: Page): Promise<HtmlState> =>
  page.evaluate(() => ({
    dark: document.documentElement.classList.contains("dark"),
    colorScheme: document.documentElement.style.colorScheme,
    bodyBg: getComputedStyle(document.body).backgroundColor,
  }));

/** Seed the stored preference before any app script runs (pre-paint path). */
async function seedTheme(page: Page, value: string) {
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k, v),
    [THEME_KEY, value] as const,
  );
}

/**
 * Read the body's painted background as concrete sRGB, colour-space-agnostic:
 * Tailwind v4 emits `slate-950` in `lab()`/`oklab()`, so string-comparing
 * `rgb(2,6,23)` is brittle. Painting the computed colour onto a 1×1 canvas and
 * sampling the pixel normalises whatever space the engine chose. `sum` is
 * r+g+b (0–765): near 0 = near-black (dark theme), near 765 = white (light).
 */
async function bodyBg(page: Page): Promise<{ r: number; g: number; b: number; sum: number }> {
  return page.evaluate(() => {
    const c = getComputedStyle(document.body).backgroundColor;
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b, sum: r + g + b };
  });
}

// ── Behavior ───────────────────────────────────────────────────────────────

test.describe("AC: three-state cycling control (Light / Dark / System)", () => {
  test("cycles System → Light → Dark → System, flipping the resolved theme", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" }); // deterministic OS = light
    await page.goto("/");

    const btn = toggle(page);
    // First-visit default is System (follows the OS, which we pinned to light).
    await expect(btn).toHaveAttribute(
      "aria-label",
      `Theme: ${LABEL.system}. Change theme.`,
    );
    expect((await htmlState(page)).dark).toBe(false);

    // System → Light
    await btn.click();
    await expect(btn).toHaveAttribute(
      "aria-label",
      `Theme: ${LABEL.light}. Change theme.`,
    );
    expect((await htmlState(page)).dark).toBe(false);

    // Light → Dark  (resolved theme flips even though the OS is light)
    await btn.click();
    await expect(btn).toHaveAttribute(
      "aria-label",
      `Theme: ${LABEL.dark}. Change theme.`,
    );
    expect((await htmlState(page)).dark).toBe(true);

    // Dark → System  (back to following the light OS)
    await btn.click();
    await expect(btn).toHaveAttribute(
      "aria-label",
      `Theme: ${LABEL.system}. Change theme.`,
    );
    expect((await htmlState(page)).dark).toBe(false);
  });
});

test("AC: choice persists across reload/session under apx.theme.v1", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  // System → Light → Dark
  await toggle(page).click();
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute(
    "aria-label",
    `Theme: ${LABEL.dark}. Change theme.`,
  );
  expect(await page.evaluate((k) => localStorage.getItem(k), THEME_KEY)).toBe(
    "dark",
  );

  await page.reload();

  // Survives the reload: still Dark, still applied.
  await expect(toggle(page)).toHaveAttribute(
    "aria-label",
    `Theme: ${LABEL.dark}. Change theme.`,
  );
  expect((await htmlState(page)).dark).toBe(true);
  expect(await page.evaluate((k) => localStorage.getItem(k), THEME_KEY)).toBe(
    "dark",
  );
});

test("AC: System mode follows a live OS prefers-color-scheme change", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/"); // default = System

  await expect(toggle(page)).toHaveAttribute(
    "aria-label",
    `Theme: ${LABEL.system}. Change theme.`,
  );
  expect((await htmlState(page)).dark).toBe(false);

  // OS flips to dark → System follows it live (no reload, no click).
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(async () => (await htmlState(page)).dark).toBe(true);

  // OS flips back to light → follows again.
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(async () => (await htmlState(page)).dark).toBe(false);
});

test("AC: explicit Light/Dark ignore live OS changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  await toggle(page).click(); // System → Light
  await expect(toggle(page)).toHaveAttribute(
    "aria-label",
    `Theme: ${LABEL.light}. Change theme.`,
  );

  // OS goes dark, but the explicit Light choice must win.
  await page.emulateMedia({ colorScheme: "dark" });
  // Give the store a beat; it must NOT flip.
  await page.waitForTimeout(150);
  expect((await htmlState(page)).dark).toBe(false);
});

test("AC: no flash of the wrong theme (pre-paint apply) — Dark stored on a light OS", async ({
  page,
}) => {
  await seedTheme(page, "dark");
  await page.emulateMedia({ colorScheme: "light" }); // light machine

  // domcontentloaded — the inline <script> at the top of <body> runs
  // synchronously before React, so by this point `.dark` is already on <html>.
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const state = await htmlState(page);
  expect(state.dark, "pre-paint script must apply .dark before first paint").toBe(
    true,
  );
  // Body is already painted dark (no white flash): near-black background.
  expect((await bodyBg(page)).sum, "body already painted dark (no white flash)")
    .toBeLessThan(120);
});

test("AC: color-scheme is set to match the active theme (native UI)", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  await toggle(page).click(); // → Light
  expect((await htmlState(page)).colorScheme).toBe("light");

  await toggle(page).click(); // → Dark
  expect((await htmlState(page)).colorScheme).toBe("dark");
});

// ── Implementation: class-based dark strategy actually drives `dark:` ─────────

test("AC: class strategy — .dark on <html> flips existing dark: utilities", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  // System on a light OS → body uses the light utility (near-white).
  const lightBg = await bodyBg(page);
  expect(lightBg.sum, "light body is near-white").toBeGreaterThan(700);

  // → Light → Dark; body's `dark:bg-slate-950` must now win purely from the
  // class (the OS is still light), proving the media→class swap works.
  await toggle(page).click();
  await toggle(page).click();
  const dark = await htmlState(page);
  expect(dark.dark).toBe(true);
  const darkBg = await bodyBg(page);
  expect(darkBg.sum, "dark body is near-black").toBeLessThan(120);
  expect(darkBg.sum).toBeLessThan(lightBg.sum); // class flip actually changed paint
});

test("AC: SSR-safe store — no hydration mismatch warning with a stored preference", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  await seedTheme(page, "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/", { waitUntil: "networkidle" });

  const hydrationNoise = errors.filter((t) =>
    /hydrat|did not match|mismatch/i.test(t),
  );
  expect(
    hydrationNoise,
    `hydration warnings: ${hydrationNoise.join(" | ")}`,
  ).toEqual([]);
});

// ── Placement & presentation ────────────────────────────────────────────────

test("AC: renders beside the GitHub icon at the same size (desktop)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");

  await expect(toggle(page)).toBeVisible();
  await expect(githubLink(page)).toBeVisible();

  const t = await toggle(page).boundingBox();
  const g = await githubLink(page).boundingBox();
  expect(t && g).toBeTruthy();
  // Same icon size (both h-9 w-9 at lg): within 2px.
  expect(Math.abs(t!.width - g!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(t!.height - g!.height)).toBeLessThanOrEqual(2);
  // Toggle sits immediately to the LEFT of the GitHub mark (per the issue).
  expect(t!.x).toBeLessThan(g!.x);
});

test("AC: renders in the mobile presentation too, with a 44px touch target", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");

  await expect(toggle(page)).toBeVisible();
  const box = await toggle(page).boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test("AC: reachable when the desktop sidebar is collapsed (icon-only rail)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(toggle(page)).toBeVisible();
  await page.getByRole("button", { name: "Collapse sidebar" }).click();

  // The footer row now stacks the icons in the rail; the toggle stays reachable.
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await expect(toggle(page)).toBeVisible();
  await expect(toggle(page)).toBeEnabled();
  // Still operable from the collapsed rail.
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute(
    "aria-label",
    `Theme: ${LABEL.light}. Change theme.`,
  );
});

for (const width of [320, 375, 1024, 1920]) {
  test(`AC: no horizontal page scroll at ${width}px (expanded)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
  });
}

test("AC: no horizontal scroll with the collapsed rail (desktop)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

// ── Accessibility (the #8 bar) ───────────────────────────────────────────────

test("AC: real button semantics; name conveys state + action", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  const tag = await toggle(page).evaluate((el) => el.tagName);
  expect(tag).toBe("BUTTON");
  // Accessible name conveys BOTH the current state and the action.
  await expect(toggle(page)).toHaveAttribute(
    "aria-label",
    /^Theme: .+\. Change theme\.$/,
  );
});

test("AC: new state announced on activation (polite live region)", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  // Nothing read on load.
  await expect(announcement(page)).toHaveText("");
  const live = announcement(page);
  expect(await live.getAttribute("aria-live")).toBe("polite");

  await toggle(page).click(); // → Light
  await expect(announcement(page)).toHaveText(`Theme: ${LABEL.light}.`);
  await toggle(page).click(); // → Dark
  await expect(announcement(page)).toHaveText(`Theme: ${LABEL.dark}.`);
});

test("AC: keyboard operable (Enter activates from focus)", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  await toggle(page).focus();
  expect(
    await page.evaluate(
      () => document.activeElement?.getAttribute("data-testid"),
    ),
  ).toBe("theme-toggle");

  await page.keyboard.press("Enter"); // System → Light
  await expect(toggle(page)).toHaveAttribute(
    "aria-label",
    `Theme: ${LABEL.light}. Change theme.`,
  );
  await page.keyboard.press(" "); // Light → Dark
  await expect(toggle(page)).toHaveAttribute(
    "aria-label",
    `Theme: ${LABEL.dark}. Change theme.`,
  );
});

test("AC: icon is decorative (aria-hidden); button carries the name", async ({
  page,
}) => {
  await page.goto("/");
  const svgHidden = await toggle(page)
    .locator("svg")
    .first()
    .getAttribute("aria-hidden");
  expect(svgHidden).toBe("true");
  // The button is NOT icon-only-with-no-name.
  const name = await toggle(page).getAttribute("aria-label");
  expect(name && name.length).toBeGreaterThan(0);
});

test("AC: respects prefers-reduced-motion (no theme-transition animation)", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto("/");

  // No transition is declared on the theme-bearing elements, so the flip is
  // instant for reduced-motion users (honored by construction).
  const htmlDur = await page.evaluate(
    () => getComputedStyle(document.documentElement).transitionDuration,
  );
  const bodyDur = await page.evaluate(
    () => getComputedStyle(document.body).transitionDuration,
  );
  expect(parseFloat(htmlDur)).toBe(0);
  expect(parseFloat(bodyDur)).toBe(0);

  // And it still functions under reduced motion.
  await toggle(page).click();
  await toggle(page).click();
  expect((await htmlState(page)).dark).toBe(true);
});

test("AC: footer control is axe-clean in both themes (AA contrast)", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  const scanFooter = async () =>
    new AxeBuilder({ page })
      .include('[data-testid="sidebar-footer"]')
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

  // Light
  await toggle(page).click(); // → Light (explicit)
  const light = await scanFooter();
  const lightSerious = light.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(
    lightSerious,
    `light footer violations: ${lightSerious.map((v) => v.id).join(", ")}`,
  ).toEqual([]);

  // Dark
  await toggle(page).click(); // → Dark (explicit)
  expect((await htmlState(page)).dark).toBe(true);
  const dark = await scanFooter();
  const darkSerious = dark.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(
    darkSerious,
    `dark footer violations: ${darkSerious.map((v) => v.id).join(", ")}`,
  ).toEqual([]);
});

// ── Evidence capture ─────────────────────────────────────────────────────────

test("evidence — light/dark/system at desktop/tablet/mobile, expanded + collapsed", async ({
  page,
}) => {
  // Standard super-board viewports (mandatory desktop/tablet/mobile), plus the
  // per-state shots the issue's Verification AC asks for.
  const setPref = async (clicks: number) => {
    for (let i = 0; i < clicks; i += 1) await toggle(page).click();
  };

  // Desktop 1920 — System (default), light OS
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await expect(toggle(page)).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE_DIR}/desktop.png`, fullPage: true });

  // Desktop light (explicit)
  await setPref(1); // System → Light
  await page.screenshot({ path: `${EVIDENCE_DIR}/light-desktop.png`, fullPage: true });

  // Desktop dark (explicit)
  await setPref(1); // Light → Dark
  await expect(toggle(page)).toHaveAttribute(
    "aria-label",
    `Theme: ${LABEL.dark}. Change theme.`,
  );
  await page.screenshot({ path: `${EVIDENCE_DIR}/dark-desktop.png`, fullPage: true });

  // Desktop system-following-dark: back to System, OS dark
  await setPref(1); // Dark → System
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(async () => (await htmlState(page)).dark).toBe(true);
  await page.screenshot({
    path: `${EVIDENCE_DIR}/system-following-dark-desktop.png`,
    fullPage: true,
  });

  // Collapsed rail — dark, then light
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await page.screenshot({
    path: `${EVIDENCE_DIR}/collapsed-dark-desktop.png`,
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "light" });
  // System now resolves to light; capture the collapsed light rail.
  await expect.poll(async () => (await htmlState(page)).dark).toBe(false);
  await page.screenshot({
    path: `${EVIDENCE_DIR}/collapsed-light-desktop.png`,
    fullPage: true,
  });

  // Tablet 1024×768 — System/light
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await expect(toggle(page)).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE_DIR}/tablet.png`, fullPage: true });

  // Mobile 375×667 — System/light (default)
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await expect(toggle(page)).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE_DIR}/mobile.png`, fullPage: true });

  // Mobile dark (explicit) — System → Light → Dark
  await setPref(2);
  await expect(toggle(page)).toHaveAttribute(
    "aria-label",
    `Theme: ${LABEL.dark}. Change theme.`,
  );
  await page.screenshot({ path: `${EVIDENCE_DIR}/mobile-dark.png`, fullPage: true });
});
