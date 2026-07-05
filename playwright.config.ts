import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the AP Exam Planner e2e suite.
 * `webServer` boots the app itself so `pnpm test:e2e` is self-contained.
 *
 * The port is `PORT`-overridable (Next.js `dev` honors the same env var):
 * with `reuseExistingServer` enabled, a hardcoded 3000 silently runs the
 * suite against WHATEVER is already listening there — e.g. an unrelated dev
 * server — and every spec fails on a foreign DOM. `PORT=3100 pnpm test:e2e`
 * sidesteps an occupied 3000 without config edits.
 */
const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
