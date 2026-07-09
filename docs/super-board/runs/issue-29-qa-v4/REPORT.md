# Issue #29 — QA v4 (R6 rebuild re-verify)

Branch: issue-29-sidebar-my-schedules @ a2e434a
PR: #35
Date: 2026-07-08

## Scope
Re-verify the R6 bounce fix (Jon, 2026-07-09): the delete-schedule confirm
dialog's backdrop must dim the sticky catalog filter bar
(STEM / Humanities / Languages / Arts / Career Kickstart) instead of leaving
it "lit up". Regression-check R5 (branding-row trim) and the full suite.

## Result: PASS

### R6 — delete-dialog backdrop dims the catalog filter bar — PASS
- Fix: DeleteScheduleDialog overlay is createPortal-ed to document.body
  (src/components/MySchedules.tsx:108), lifting the `fixed inset-0 z-50`
  overlay out of the now-sticky sidebar's stacking context so it paints over
  <main>'s `sticky top-0 z-30` filter bar.
- Verified visually at 1920x1080, dialog open on "Schedule 2": the whole app
  (filter bar included) is dimmed behind the modal —
  r6-delete-dialog-filterbar-dimmed-desktop.png.
- Verified at scroll depth (scrollY~600): the sticky filter bar stays dimmed
  under the backdrop — r6-delete-dialog-filterbar-dimmed-desktop-scrolled.png.
- elementFromPoint at the STEM chip's center returns the overlay, not the chip
  (committed regression test e2e/issue-29-revision.spec.ts R6 case); the test
  also asserts the dialog has no <aside> ancestor (portaled out).

### R5 — branding-row copy trim — PASS (regression)
- No tagline <p> beneath the h1; branding row is items-center, "AP Exam
  Planner" is the single h1 beside the AP mark — r5-branding-row-desktop.png,
  desktop.png.

## Full verify (fresh worktree, PORT=3100)
- tsc: pass
- unit (test:unit): 109 passed
- data (test:data): 43 passed
- lint: pass (clean)
- build (next build): pass
- e2e (playwright test): 201/201 passed

## Evidence files
- desktop.png — 1920x1080 baseline
- tablet.png — 1024x768
- mobile.png — 375x667
- r5-branding-row-desktop.png — branding-row close-up (trim verified)
- r6-delete-dialog-filterbar-dimmed-desktop.png — dialog open, filter bar dimmed (top)
- r6-delete-dialog-filterbar-dimmed-desktop-scrolled.png — sticky filter bar dimmed mid-scroll
