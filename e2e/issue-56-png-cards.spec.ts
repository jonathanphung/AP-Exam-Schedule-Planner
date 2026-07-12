import { test, expect, type Download } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Builder evidence + acceptance drive for issue #56 — the designed per-week
 * PNG cards. Exercises the REAL app (real dataset, real download pipeline) and
 * saves the ACTUAL downloaded files for the AC's required matrix: a 1-week, a
 * 2-week, and a full 3-week export (with a moved-to-late exam), light + dark.
 *
 * Selections are seeded through the legacy localStorage keys the schedules
 * store migrates on first load (`apx.selection.v1` / `apx.resolutions.v1`), so
 * the 3-week case gets its moved-to-late Latin exam without driving the
 * conflict dialog:
 *   - Biology (2026-05-04 AM) → Week 1
 *   - Seminar exam (2026-05-11 PM) → Week 2, plus its Apr 30 portfolio → Week 1
 *   - Latin shares Biology's slot; keeping Biology bumps Latin to 2026-05-18 PM
 *     → the Late Testing week.
 */

const EVIDENCE_DIR = "docs/super-board/runs/issue-56-build-v1";

interface Scenario {
  key: string;
  selection: string[];
  resolutions: unknown[];
  expected: string[];
}

const KEEP_BIOLOGY = {
  date: "2026-05-04",
  session: "AM",
  keeperId: "biology",
  memberIds: ["biology", "latin"],
};

const SCENARIOS: Scenario[] = [
  {
    key: "1week",
    selection: ["biology"],
    resolutions: [],
    expected: ["ap-exams-2026-week-1.png"],
  },
  {
    key: "2week",
    selection: ["biology", "seminar"],
    resolutions: [],
    expected: ["ap-exams-2026-week-1.png", "ap-exams-2026-week-2.png"],
  },
  {
    key: "3week",
    selection: ["biology", "latin", "seminar"],
    resolutions: [KEEP_BIOLOGY],
    expected: [
      "ap-exams-2026-week-1.png",
      "ap-exams-2026-week-2.png",
      "ap-exams-2026-late-testing.png",
    ],
  },
];

const THEMES = ["light", "dark"] as const;

test.beforeAll(() => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
});

for (const scenario of SCENARIOS) {
  for (const theme of THEMES) {
    test(`${scenario.key} · ${theme} — emits exactly ${scenario.expected.length} designed week card(s)`, async ({
      page,
    }) => {
      await page.addInitScript(
        ([sel, res, th]) => {
          try {
            localStorage.setItem("apx.selection.v1", JSON.stringify(sel));
            localStorage.setItem("apx.resolutions.v1", JSON.stringify(res));
            localStorage.setItem("apx.theme.v1", th as string);
          } catch {}
        },
        [scenario.selection, scenario.resolutions, theme] as const,
      );

      await page.goto("/");
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.documentElement.classList.contains("dark"),
          ),
        )
        .toBe(theme === "dark");

      const trigger = page.getByTestId("export-menu-button");
      await expect(trigger).toBeEnabled();

      const downloads: Download[] = [];
      page.on("download", (d) => downloads.push(d));

      await trigger.click();
      await expect(page.getByTestId("export-menu")).toBeVisible();
      await page
        .getByRole("menuitem", { name: "Save as .png", exact: true })
        .click();

      await expect
        .poll(() => downloads.length, { timeout: 20000 })
        .toBe(scenario.expected.length);

      // Exact set of emitted week files, in chronological week order.
      expect(downloads.map((d) => d.suggestedFilename())).toEqual(
        scenario.expected,
      );

      for (const download of downloads) {
        const buf = readFileSync(await download.path());
        // PNG signature + non-zero IHDR dimensions (crisp, real raster).
        expect([...buf.subarray(0, 8)]).toEqual([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]);
        expect(buf.readUInt32BE(16)).toBeGreaterThan(0);
        expect(buf.readUInt32BE(20)).toBeGreaterThan(0);
        writeFileSync(
          `${EVIDENCE_DIR}/${scenario.key}-${theme}-${download.suggestedFilename()}`,
          buf,
        );
      }
    });
  }
}
