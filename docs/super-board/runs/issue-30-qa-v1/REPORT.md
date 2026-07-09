# QA evidence — issue #30 (orange conflict blocks + pastel palette) — v1

- **Verdict:** PASS (all 8 ACs)
- **Branch:** `issue-30-calendar-pastel-palette` @ Builder commit `c4f13f2`
- **Specs:**
  - `e2e/issue-30-calendar-palette.spec.ts` (Builder) — 5 tests, the per-AC regression guard
    (orange override, ⚠️ + worded label, resolve fallback, light distinctness, AA contrast both themes)
  - `e2e/issue-30-qa.spec.ts` (QA, new) — 6 tests: 3-viewport screenshot evidence with zero
    console/page-error guards, AC3 moved-to-late affordance survival, **AC4 distinctness measured in
    DARK mode** (the Builder measured light only; the AC demands both themes), AC6 dark screenshots,
    AC8 legend + off-grid pastel accents incl. Career Kickstart.
- **Commands (run in the QA worktree, PORT=3130 to dodge the orphaned :3000 server):**
  - `PORT=3130 pnpm test:e2e issue-30-calendar-palette.spec.ts` → **5 passed** (15.9s)
  - `PORT=3130 pnpm test:e2e issue-30-qa.spec.ts` → **6 passed** (5.5s)
  - `PORT=3130 pnpm test:e2e` (full suite) → **142 passed** (47.7s)
  - `pnpm test:unit` → **93 passed** · `pnpm test:data` → **42 passed** · `pnpm lint` → clean

## Per-AC results

| AC | Test | Result |
|----|------|--------|
| AC1 unresolved conflict → both blocks orange, category overridden | Builder `AC1/AC2 — unresolved conflict paints both blocks orange…` (cross-category STEM Biology + Languages Latin both `bg-orange-200`, neither emerald nor rose) + QA 3-viewport evidence tests | ✅ |
| AC2 ⚠️ before name, `aria-hidden`, conflict worded in accessible name | same Builder test (`block-conflict-marker` ×2 with `aria-hidden="true"`, `aria-label` contains "unresolved time conflict", visible "Time conflict" caption) | ✅ |
| AC3 resolved → both back to category styling; moved-to-late affordances unchanged | Builder `AC3 — resolved conflict drops the orange…` + QA `AC3 evidence — …` (keeper rose again, mover emerald at its late slot with the pre-existing "Moved to late testing" caption + aria wording intact, zero markers) | ✅ |
| AC4 orange distinct from every pastel category in light AND dark | Builder `AC4 — …distinct pastel fills…` (light, measured composited rgb) + QA `AC4/AC6 — dark mode…` (dark, measured: every category fill ≠ dark orange fill, all pairwise distinct) | ✅ |
| AC5 five `CATEGORY_STYLES` move to a pastel scheme, distinguishable | Builder AC4 distinctness (4 block-bearing categories) + QA AC8 (5th hue — Career Kickstart cyan — verified on its legend/off-grid accent; CK has no exam-bearing subject so it never renders a block) | ✅ |
| AC6 dark mode muted/soft treatment, both themes in evidence | `bg-{h}-900` deep desaturated fills + `text-{h}-50` (not inverted light pastels); `dark-conflict-desktop.png` + `dark-resolved-desktop.png` vs light shots | ✅ |
| AC7 WCAG AA ≥4.5:1 block text on fills, both themes, measured | Builder AC5 ×2 (live canvas-normalised measurement, ratios below) | ✅ |
| AC8 legend / dots / off-grid markers on the same pastel scheme | QA `AC8 — legend and off-grid markers…` (legend dots `bg-{hue}-500` + `dark:bg-{hue}-400` for STEM/Humanities/Languages/Arts; off-grid Drawing fuchsia + Cybersecurity cyan markers) | ✅ |

## Measured contrast ratios (AC7 — live from rendered colours, canvas-normalised for Tailwind v4 oklch)

| Fill | Light | Dark |
|------|-------|------|
| STEM (emerald) | 8.47:1 | 9.14:1 |
| Humanities (indigo) | 9.32:1 | 10.26:1 |
| Languages (rose) | 8.00:1 | 8.75:1 |
| Arts (fuchsia) | 8.68:1 | 9.40:1 |
| **Conflict (orange)** | **6.94:1** | **8.90:1** |

All ≥ 4.5:1 (WCAG AA for the blocks' small text) in both themes. Values reproduce the Builder's
PR table exactly (independent rerun, same canvas-compositing method as issue #8).

## Screenshots

- `desktop.png` / `tablet.png` / `mobile.png` — conflict week (Biology + Latin orange, ⚠️ + "Time
  conflict", pastel Chemistry/Euro History/Chinese alongside), light, 1920×1080 / 1024×768 / 375×667
- `dark-conflict-desktop.png` — same conflict week in dark mode (deep desaturated fills, light text)
- `ac3-resolved-keeper-desktop.png` — after "Keep AP Latin": Latin back to rose pastel, no marker
- `ac3-resolved-mover-late-desktop.png` — Biology at its late slot, emerald, "Moved to late testing"
- `dark-resolved-desktop.png` — resolved state in dark mode (orange gone, measured)
- `ac8-legend-offgrid-desktop.png` — legend dots + "Not placed on the grid" rows (AP Drawing
  fuchsia portfolio row, AP Cybersecurity cyan undated row)

## Notes

- Conflict style is separated on three axes, not colour alone: reserved orange hue, full 2px outline
  (vs. categories' single left accent bar), ⚠️ + visible "Time conflict" caption, with the conflict
  worded in the accessible name — meets the "colour is never the only signal" clause.
- Presentation-only change confirmed: full suite (142 e2e incl. #5 conflict-resolution, #19 calendar,
  #7 ICS export suites) green on this branch; no logic/dataset/export diffs beyond `CalendarView.tsx`.
