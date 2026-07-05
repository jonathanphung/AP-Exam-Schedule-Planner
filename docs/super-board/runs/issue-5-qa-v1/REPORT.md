# issue #5 — QA v1 report (Tester lane)

Branch: `issue-5-conflict-resolution` · Base: `main` · Builder commit: `8c62dad`
Date: 2026-07-05 · Verdict: **FAIL (1 defect — AC5 warning copy)**

## Test commands

| Command | Result |
|---|---|
| `pnpm test:unit` | PASS — 22 tests (21 Builder + 1 QA AC4 chain) — `test-unit.log` |
| `PORT=3100 pnpm test:e2e` | 45 pass / **1 fail** (AC5 exact-copy assertion) — `test-e2e-full.log` |
| `PORT=3100 pnpm exec playwright test e2e/issue-5-conflict-resolution.spec.ts` | 10 pass / **1 fail** — `test-e2e-issue-5.log` |
| `pnpm lint` | PASS (0 problems) |
| `pnpm test:data` | PASS (34) |
| `pnpm build` | PASS |

Note: e2e ran on PORT=3100 because an unrelated dev server (different repo)
holds :3000 on this machine; `playwright.config.ts` was made `PORT`-overridable
in this lane so the suite can never silently target a foreign app again.

## Per-AC results

| AC | Test | Result |
|---|---|---|
| AC1 prompt on collision (2nd select + persisted load) | e2e AC1 | PASS |
| AC2 keeper choice → non-keeper to ITS OWN late slot + tag | e2e AC2 | PASS |
| AC3 persistence, reload, deselect-clears, re-prompt | e2e AC3 | PASS |
| AC4 3+ subjects, choose-one flow | unit `src/lib/conflicts.qa.test.ts` (no 3-way slot exists in the 2026 dataset, so lib-level chain test) | PASS |
| AC5 late-late collision → visible named warning, no overwrite, no 2nd prompt | e2e AC5 | **FAIL — copy defect** (below) |
| AC6 coordinator wording in prompt + moved tag | e2e AC6 | PASS |
| AC7 portfolio deadlines never conflict | e2e AC7 | PASS |
| AC8 pure functions + unit tests via `pnpm test:unit` | command run | PASS |
| AC9 resolved slot renders; WCAG AA contrast light+dark | e2e AC9 (canvas-resolved oklch colors; all measured ratios ≥ 4.5:1) | PASS |

## Defect (AC5)

The late-late warning names the shared slot as `(PMsession)` — missing space:

> AP Biology and AP Chemistry now share the late-testing slot Wednesday,
> May 20, 2026 **(PMsession)**. …

- Repro: select biology + latin + chemistry + human-geography → keep Latin →
  keep Human Geography → read `[data-testid="late-collision-warning"]`.
- Root cause: `src/components/ScheduleView.tsx` lines 187–189 rely on implicit
  JSX whitespace across the line break after `{collision.slot.session}`; the
  compiled text node is `"session). Late testing…"` (leading space dropped).
- Red spec: `e2e/issue-5-conflict-resolution.spec.ts` AC5 exact-phrase
  assertion (`"<date> (<session> session)"`), committed red on this branch.
- Fix shape: build the slot phrase in ONE expression, mirroring
  ConflictDialog's template-literal approach, e.g.
  ``{`${formatDateLabel(collision.slot.date)} (${collision.slot.session} session)`}``.
- Screenshot: `ac5-warning-closeup-desktop.png` (broken state).

## Evidence files

- `desktop.png` / `tablet.png` / `mobile.png` — conflict prompt (AC1/AC6) at standard viewports
- `ac2-moved-to-late-desktop.png` — keeper chosen, moved tag under late date
- `ac5-late-late-warning-desktop.png` + `ac5-warning-closeup-desktop.png` — broken copy
- `ac7-portfolio-no-conflict-desktop.png` — shared portfolio deadline, no prompt
- `ac9-dark-prompt-desktop.png` — dark-mode prompt (contrast-checked)
- `test-unit.log`, `test-e2e-issue-5.log`, `test-e2e-full.log`
