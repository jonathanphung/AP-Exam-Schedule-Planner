# QA evidence — issue #19 (calendar grid view) — v2 (week-pager design bounce)

- **Verdict:** PASS (all 8 original ACs + all 7 bounce requirements)
- **Branch:** `issue-19-calendar-grid-view` @ Builder rebuild commit `1451d4a`
- **Design under test:** v2 after Jon's pre-merge bounce on PR #27 — ONE testing
  week at a time, paged by visible Previous/Next buttons; the pager replaces
  vertical month scrolling. Pages derive from `REGULAR_WINDOWS` +
  `LATE_TESTING_WINDOW` (schema, never hardcoded).
- **Spec:** `e2e/issue-19-calendar-view.spec.ts` — 13 tests: one observable test
  per AC (AC8 expands to 3 viewport tests + 1 keyboard-focus test), a dedicated
  pager-a11y test (bounce item 4), and a QA-added test for bounce item 5's
  dynamic default (follows the live selection until the student pages manually).
- **Commands (run in the QA worktree, PORT=3100 to dodge the orphaned :3000 server):**
  - `PORT=3100 pnpm test:e2e` (full suite, includes issue spec) → **92 passed** (40.3s)
  - Prior full-suite run at Builder HEAD before the QA-added test → **91 passed** (41.1s)
  - `pnpm test:unit` → **69 passed** · `pnpm test:data` → **34 passed** · `pnpm lint` → clean

## Per-AC results

| AC | Test | Result |
|----|------|--------|
| AC1 switcher (keyboard, pressed state, list default, reduced-motion) | `AC1 — switcher defaults to list…` | ✅ |
| AC2 (amended by bounce) one week per page, hourly axis, dated headers, every window reachable via pager | `AC2 — pager walks every published week…` (walks all 3 windows; exactly ONE week section mounted per page; 5 dated columns each; 8 AM/12 PM/2 PM ticks; ends disabled both directions) | ✅ |
| AC3 effective slot via resolveSlots/buildSchedule | `AC3 — resolved conflict places the moved exam…` (unresolved pair lane-splits on May 4; after "Keep AP Latin", Biology renders in the May 20 column of the late-testing page at the dataset PM start, "Moved to late testing"; Latin stays on week 1 — one week mounted at a time) | ✅ |
| AC4 category colors + name + start time | `AC4 — blocks are category-colored…` (colors collected ACROSS pager pages: STEM=STEM equal, cross-category differ; legend lists used categories only; Next-button badge "2 exams in later weeks" in the accessible name) | ✅ |
| AC5 off-grid list, nothing invented | `AC5 — portfolio deadlines and undated subjects…` (default page = Seminar's week 2 — off-grid entries never influence the default; Drawing + Seminar portfolio listed, Cybersecurity "No May 2026 exam date", exactly 1 block on grid) | ✅ |
| AC6 empty state | `AC6 — empty selection renders a hint…` (empty state replaces grid AND pager) | ✅ |
| AC7 cycle banner from dataset | `AC7 — banner names the dataset cycle` | ✅ |
| AC8 375/1024/1920 usability + a11y | 3 viewport tests (body h-overflow ≤ 0, pager buttons always visible, one week section mounted, grid scrolls internally at 375, zero console/page errors) + focus-visible ring test | ✅ |

## Bounce-requirement results

| Bounce item | Test | Result |
|----|------|--------|
| B1 one week at a time, no month stack | AC2/AC8: `weekSections` count === 1 on every page and viewport | ✅ |
| B2 visible prev/next over schema-derived weeks | AC2 walks `REGULAR_WINDOWS` + `LATE_TESTING_WINDOW` imported from `src/data/schema` | ✅ |
| B3 current-week indicator + documented ends | Indicator shows "May 4 – May 8 · Week 1 of 3" (+ LATE TESTING badge on week 3); ends DISABLE (no wrap) asserted at both ends | ✅ |
| B4 pager a11y | `Pager a11y — …`: real buttons, accessible names "Previous week"/"Next week", Tab-reachable, Enter+Space page, aria-live=polite + aria-atomic indicator, focus-visible ring, reduced-motion emulated | ✅ |
| B5 default page + badges | AC5 (default = first week with a placed exam), AC4 (badge count folded into accessible name), QA-added `Bounce 5 — default page follows the live selection…` (default follows live catalog toggles; after manual paging the student's position wins) | ✅ |
| B6 approved ACs intact, pager replaces scrolling | AC3–AC8 above; body h-overflow ≤ 0 at 375/1024/1920 | ✅ |
| B7 e2e rewritten for the pager | This spec (13 tests) replaces the v1 month-scroll assertions | ✅ |

## Screenshots

- `desktop.png` / `tablet.png` / `mobile.png` — full page, calendar view, 6-subject selection, week 1 with pager
- `ac1-switcher-calendar-active-desktop.png` — Calendar chip active state
- `ac2-week1-grid-desktop.png` — week 1 page (Previous disabled, Next badged)
- `ac2-late-week-grid-desktop.png` — week 3 page (LATE TESTING badge, Next disabled)
- `ac3-unresolved-lane-split-desktop.png` — Biology + Latin side-by-side in the shared May 4 slot
- `ac3-moved-to-late-desktop.png` — Biology on the late-testing page (May 20 column, PM start)
- `ac4-category-colors-desktop.png` — category-colored blocks + legend
- `ac5-offgrid-list-desktop.png` — "Not placed on the grid" list
- `ac6-empty-state-desktop.png` — zero-selection hint (no grid, no pager)
- `pager-keyboard-week2-desktop.png` — week 2 reached by keyboard (Enter on Next)
- `bounce5-default-follows-then-manual-wins-desktop.png` — QA-added dynamic-default test end state

## QA notes

- QA-added test (`Bounce 5`) covers the one bounce behavior the Builder's suite
  asserted only statically: the default page re-follows the live selection
  (catalog toggles while the calendar is mounted — also the issue-notes "reacts
  live" constraint) and stops following after a manual page.
- Builder's documented design decisions (nominal 2-hour block height, disable-
  at-ends, badge-instead-of-quick-jump, default-follows-until-manual-page) all
  observed in the running app exactly as documented in the PR description.
- No flake observed across two full-suite runs (91/91 at Builder HEAD, 92/92
  with the QA-added test).
