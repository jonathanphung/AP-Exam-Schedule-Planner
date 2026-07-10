# QA evidence — issue #50, v1 (PASS)

Replace the `↗` character (emoji presentation on Windows) with the inline SVG
`ArrowUpRightIcon` — sidebar resource links + InfoPanel "Official College
Board page" button.

- Branch: `issue-50-svg-arrow-icon` @ da86e0e (Builder) + this QA commit
- Spec: `e2e/issue-50-qa.spec.ts` — 13 tests, one observable test per AC
- Full regression: `PORT=3200 pnpm test:e2e` -> **332 passed** (319 pre-existing
  + 13 new) · `pnpm test:unit` -> 141 · `pnpm test:data` -> 61 · `pnpm lint` clean

## Per-AC verdicts

| AC | Verdict | How verified |
|----|---------|--------------|
| AC1 shared icon, aria-hidden, currentColor, no hardcoded fills | PASS | All 8 resource links + CB button carry exactly one `svg[aria-hidden="true"]` with `stroke="currentColor"`, `fill="none"`, zero descendants with a fill; computed stroke === computed link color in **light and dark** (dark proves inheritance: blue-300 vs light blue-700) |
| AC2 `↗` gone | PASS | Source: `grep -rn "↗" src/` -> 0 hits (remaining hits are comments in e2e files only). DOM: zero text nodes containing U+2197 on desktop (dialog open) and mobile (disclosures open) |
| AC3 sized/aligned 1em, same gap | PASS | Icon box resolves to exactly 1em of each call site's font — 16x16 in the sidebar links (16px inherited font; the Builder docblock's "both call sites are text-sm" is wrong for this site — em sizing makes the icon correct there anyway, note below), 14x14 in the `text-sm` CB button; 4px `gap-1` unchanged; icon inside the single 22px line box; CB icon vertically centered ±1px. Collapsed sidebar: resources fully hide in the w-10 rail, restore on expand |
| AC4 #29 hover rule | PASS | Hover underlines the label span only; the SVG and the anchor itself never carry `text-decoration: underline` |
| AC5 a11y unchanged | PASS | Icon `aria-hidden`; `.sr-only` "(opens in a new tab)" intact on all 9 external links; accessible names contain the hint and no arrow character; app-level axe scan (e2e/a11y.spec.ts) green in the full-suite run |
| AC6 no layout shift | PASS | Measured **before (main @ 447059b) vs after (branch)**, table below. Panel 320px -> 320px; row height 22px -> 22px; gap 4px -> 4px; every label untruncated on one line at 1024/1440/1920 |
| AC7 one visible affordance + evidence | PASS | Each external link (8 sidebar + CB button): exactly one SVG arrow, zero text arrows. Screenshots light+dark x desktop/tablet/mobile + CB closeups in this folder |

## Before/after geometry (desktop 1920x1080, real measurements)

| Metric | main (↗ char) | branch (SVG) |
|---|---|---|
| Sidebar panel width | 320px | 320px |
| Link row height | 22px | 22px |
| Label->affordance gap | 4px | 4px |
| Affordance box | 12.09x22 (glyph span) | 16x16 (svg, top offset 1px — baseline-aligned) |
| Longest link ("AP coordinator dates and deadlines") | 279.52px | 283.42px (+3.9px, fits 320px panel one-line) |
| Font / line-height at call site | 16px / 22px | 16px / 22px |

## Notes

1. **Builder docblock inaccuracy (non-blocking):** `ArrowUpRightIcon.tsx` says
   "Both current call sites render at `text-sm` (14px)". The sidebar resource
   links actually inherit the 16px root size (no text-size utility on the
   anchor or its ancestors); only the CB button is `text-sm`. The `1em` sizing
   decision is exactly what makes this harmless — the icon tracks each context
   correctly (16px / 14px), which AC3 wants. The spec pins both sizes so a
   silent font-context change fails loudly. Not worth a rebuild round; flagged
   for the Reviewer to fix the comment on merge or ignore.
2. The Next.js dev-overlay badge visible bottom-left in some screenshots is a
   dev-server artifact, pre-existing in prior issues' committed evidence
   (e.g. `issue-44-qa-v3/biology-partless-dark-desktop.png`); zero console
   errors/warnings on load (checked light+dark).
3. Dark-theme capture uses `emulateMedia({ colorScheme: "dark" })` with the
   default "system" preference — same class-based `.dark` path the #41 toggle
   drives.
