# QA v2 — issue #30 · Calendar: orange conflict blocks + pastel palette

**PR:** #34 · **Branch:** `issue-30-calendar-pastel-palette` · **Pass:** v2 (post-bounce, exact-hex palette)

QA re-verification after Jon's post-approval human bounce on PR #34 requesting the EXACT category
hex codes. v1 verified the pastel/orange *system*; v2 re-verifies the swapped palette + re-measures
contrast (Arts #FF9AA2 is the new tightest, Humanities #F7DC8D is the new nearest neighbour to the
conflict orange). All previously-approved behaviour re-checked, not assumed.

## Verdict: PASS — all 8 ACs verified

| AC | Requirement | Result |
|----|-------------|--------|
| 1 | Unresolved conflict -> members orange, overriding category | PASS Biology (STEM blue) + Latin (Languages green) both render bg-[#FDBA74]/border-[#EA580C] |
| 2 | Warning marker before name; decorative for AT; conflict worded in accessible name | PASS warn glyph aria-hidden, visible "Time conflict" caption, accessible name has "unresolved time conflict, action needed" |
| 3 | Resolve -> both revert to category styling; existing late affordances intact | PASS keeper Latin -> bg-[#C9E89B] (0 markers); mover Biology -> bg-[#C7CEEA] at late slot, "Moved to late testing" + aria-label survive, no "time conflict" |
| 4 | Orange distinct from every pastel, both themes | PASS measured composited fills all differ from orange + pairwise, light AND dark |
| 5 | Exact-hex pastel palette in CATEGORY_STYLES | PASS STEM #C7CEEA / Humanities #F7DC8D / Languages #C9E89B / Arts #FF9AA2 / Career Kickstart #CDB4DB |
| 6 | Dark = muted same-hue (not inverted pastels, not old hues) | PASS deep desaturated same-hue fills w/ light text; old emerald/indigo/rose/fuchsia gone |
| 7 | Text on fill clears WCAG AA (>=4.5:1) both themes, ratios in evidence | PASS see contrast-ratios.txt; tightest light Arts 5.09:1 |
| 8 | Legend dots + off-grid markers follow the pastel scheme | PASS legend 4 pastel dots; off-grid AP Drawing (Arts pink) + AP Cybersecurity (Career Kickstart lavender) match |

## Measured contrast (canvas-normalised composite, oklch-safe)
- Light (AA >=4.5): STEM 7.71 / Humanities 6.60 / Languages 6.32 / Arts 5.09 (tightest) / Conflict 5.56
- Dark  (AA >=4.5): STEM 9.46 / Humanities 7.83 / Languages 8.16 / Arts 8.72 / Conflict 8.27

## Full suite (QA worktree, fresh pnpm install)
- test:data  42 passed
- test:unit  93 passed
- test:e2e   142 passed (incl. issue-30-calendar-palette + issue-30-qa)
- lint       clean (exit 0)

## Distinctness note (Jon's bounce concern)
Conflict orange deepened to #FDBA74 (orange-300 weight) so it stays clearly deeper/warmer against
the new yellow Humanities pastel #F7DC8D. Confirmed visually (desktop light) and by the AC4
fill-difference assertions in both themes.

## Evidence files (this folder)
- desktop.png / tablet.png / mobile.png  - unresolved conflict, standard viewports (light)
- dark-conflict-desktop.png              - conflict state, dark theme
- ac3-resolved-keeper-desktop.png / ac3-resolved-mover-late-desktop.png - resolved state
- dark-resolved-desktop.png              - resolved state, dark theme
- ac8-legend-offgrid-desktop.png         - legend + off-grid pastel markers (incl. Career Kickstart lavender)
- contrast-ratios.txt                    - measured AA table
- test-data.log / test-unit.log / lint.log / test-e2e-issue-30.log
