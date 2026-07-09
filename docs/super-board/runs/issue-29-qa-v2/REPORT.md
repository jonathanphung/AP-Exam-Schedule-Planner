# QA report — issue #29, v2 (post-approval bounce re-verification)

- **Issue:** #29 — Redesign sidebar: branded panel with My Schedules — multiple switchable schedules saved client-side
- **PR:** #35 · branch `issue-29-sidebar-my-schedules`
- **Commit under test:** 8d4e751 (builder revision for Jon's post-approval bounce)
- **QA pass:** v2 — scope = revision items R1–R4 + full regression of the 13 previously-approved ACs
- **Date:** 2026-07-08
- **Verdict: PASS** — all revision items verified, zero regressions.

## What this pass verified

Jon's human bounce on the approved PR #35 asked for three changes (plus evidence/spec refresh):

| # | Revision item | Result | Verified by |
|---|---|---|---|
| R1 | Desktop sidebar is **sticky** — pinned while the main content scrolls, viewport-capped with internal scroll, fully usable at any depth; mobile unchanged | ✅ | builder: `issue-29-revision.spec.ts` (position sticky, usable at full scroll depth) · QA: `issue-29-qa-v2.spec.ts` — pins at exactly `top-10` (40px) at mid-scroll AND page bottom; at a short viewport (1280×600) `#sidebar-sections` scrolls internally (`overflow-y: auto`, scrollHeight > clientHeight, last resource link reachable) while the footer stays in view with `window.scrollY === 0` |
| R2 | Collapse toggle uses the **panel-collapse glyph** (rect + left column, filled when expanded / outline when collapsed) instead of the arrow; `aria-expanded`, keyboard operation, remembered state unchanged | ✅ | builder: glyph shape in both states + accessible names · QA: remembered state restores the **matching glyph after reload** in both directions (collapsed → outline-only, expanded → filled column) |
| R3 | **Footer row** pinned below the content: "Send us Feedback" left (repo new-issue page), GitHub icon right (repo link, new tab, `rel="noopener noreferrer"`, accessible name), one row; text underlines on hover, ↗/icon never does; ≥44px touch targets on mobile | ✅ | builder: geometry (same row, left/right order, below sections), hrefs, target/rel, hover-underline split, 44px targets · QA: full accessible names incl. the "(opens in a new tab)" disclosure on both links |
| R4 | Footer row in **both presentations** (desktop column + mobile card); e2e specs updated; evidence re-captured | ✅ | builder: desktop + mobile presence · QA: present at the exact `lg` boundary (1024px, desktop column) and on mobile with **both disclosures still closed** (default state — footer does not depend on opening anything); no horizontal scroll at either viewport |

## Regression — previously-approved ACs (all binding)

- Full e2e suite: **176/176 passed** (`e2e.log`), including the 20-test `issue-29-qa.spec.ts` v1 suite (AC1–AC13), the builder's 5-test `issue-29-revision.spec.ts`, and my 6-test `issue-29-qa-v2.spec.ts`, plus every other issue's accumulated suite and the axe a11y scan.
- Unit 109/109 (`unit.log`) · data 43/43 (`data.log`) · `tsc --noEmit` clean (`tsc.log`) · eslint clean (`lint.log`) · production build clean (`build.log`).
- Command: `PORT=3100 QA_EVIDENCE_DIR=docs/super-board/runs/issue-29-qa-v2 pnpm test:e2e` (port 3100 per the repo's known port-3000 squatter).

## Test-plan note (what QA added beyond the builder's spec)

The builder's `issue-29-revision.spec.ts` proved the sticky panel is *on screen* at full scroll depth; it did not prove the pinned offset, the internal-scroll mechanics, glyph restoration after reload, accessible-name completeness, the `lg`-boundary presentation, or that the mobile footer is independent of the disclosures' state. `e2e/issue-29-qa-v2.spec.ts` (6 tests) closes exactly those gaps. One test bug was found and fixed **in my own spec** during the pass (scroll target beyond the page's max scroll offset at 1920px — clamped to the measured `maxScroll`); no product defects found.

## Evidence files

| File | Shows |
|---|---|
| `desktop.png` | 1920×1080 full page, expanded panel + footer row |
| `desktop-sticky-midscroll.png` | R1 — main content scrolled deep, panel pinned at 40px with footer visible |
| `desktop-short-internal-scroll.png` | R1 — 1280×600: sections scrolled internally, footer pinned in view, page unscrolled |
| `desktop-collapsed.png` | slim rail (collapsed) — main content widened |
| `desktop-collapsed-reload-glyph.png` | R2 — collapsed state restored after reload with the outline panel glyph |
| `tablet.png` | 1024×768 full page (desktop column at the lg boundary, footer present) |
| `mobile.png` | 375×667 full page — card presentation, disclosures closed, footer row visible |
| `mobile-footer.png` | R3/R4 — mobile card close-up: Send us Feedback ↗ left, GitHub icon right |
| `mobile-schedules-open.png` | regression — My Schedules disclosure open on mobile |
| `delete-dialog.png` | regression — focus-trapped delete-confirm dialog |
| `tsc.log`, `unit.log`, `data.log`, `lint.log`, `build.log`, `e2e.log` | full verify chain |
