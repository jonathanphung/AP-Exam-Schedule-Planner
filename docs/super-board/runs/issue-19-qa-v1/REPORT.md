# QA evidence — issue #19 (calendar grid view) — v1

- **Verdict:** PASS (all 8 ACs)
- **Branch:** `issue-19-calendar-grid-view` @ Builder commit `4d544c6`
- **Spec:** `e2e/issue-19-calendar-view.spec.ts` — 11 tests, one observable test per AC
  (AC8 expands to 3 viewport tests + 1 keyboard-focus test)
- **Commands (run in the QA worktree, PORT=3119 to dodge the orphaned :3000 server):**
  - `PORT=3119 pnpm test:e2e issue-19-calendar-view.spec.ts` → **11 passed** (5.4s)
  - `PORT=3119 pnpm test:e2e` (full suite) → **90 passed** (55.7s)
  - `pnpm test:unit` → **65 passed** · `pnpm lint` → clean

## Per-AC results

| AC | Test | Result |
|----|------|--------|
| AC1 switcher (keyboard, pressed state, list default, reduced-motion) | `AC1 — switcher defaults to list…` | ✅ |
| AC2 hourly axis + dated headers, all window days, vertical scroll | `AC2 — grid covers every day…` (15 dated columns, 3 week sections, 8 AM/12 PM/2 PM ticks) | ✅ |
| AC3 effective slot via resolveSlots/buildSchedule | `AC3 — resolved conflict places the moved exam…` (unresolved pair renders lane-split on May 4; after "Keep AP Latin", Biology renders May 20 · 12 p.m. "Moved to late testing" in BOTH views) | ✅ |
| AC4 category colors + name + start time | `AC4 — blocks are category-colored…` (STEM=STEM bg equal, cross-category bgs differ, legend lists used categories only) | ✅ |
| AC5 off-grid list, nothing invented | `AC5 — portfolio deadlines and undated subjects…` (Drawing + Seminar portfolio listed, Cybersecurity "No May 2026 exam date", exactly 1 block on grid) | ✅ |
| AC6 empty state | `AC6 — empty selection renders a hint…` | ✅ |
| AC7 cycle banner from dataset | `AC7 — banner names the dataset cycle` | ✅ |
| AC8 375/1024/1920 usability + a11y | 3 viewport tests (body h-overflow ≤ 0, grid scrolls internally at 375, zero console/page errors) + focus-visible ring test | ✅ |

## Screenshots

- `desktop.png` / `tablet.png` / `mobile.png` — full page, calendar view, 6-subject selection
- `ac1-switcher-calendar-active-desktop.png` — Calendar chip active state
- `ac2-grid-weeks-desktop.png` — all three week grids, full page
- `ac3-unresolved-lane-split-desktop.png` — Biology + Latin side-by-side in the shared May 4 slot
- `ac3-moved-to-late-desktop.png` — Biology at May 20 · 12 PM in the LATE TESTING week
- `ac4-category-colors-desktop.png` — category-colored blocks + legend
- `ac5-offgrid-list-desktop.png` — "Not placed on the grid" list
- `ac6-empty-state-desktop.png` — zero-selection hint

## Test-maintenance note (QA-owned)

The new view-switcher chips legitimately enter the tab order between the
catalog and the schedule, which invalidated one hardcoded tab-walk assertion
in the pre-existing `e2e/a11y.spec.ts` (issue #8). Updated that walk to expect
the two chips (with focus-indicator checks) before the export button — app
behavior is correct; the assertion was stale. Full suite green after the fix.
