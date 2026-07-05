# QA report — issue #5, v2 (re-verification after AC5 rebuild)

- **Issue:** #5 — Detect same-slot conflicts and resolve to official late-testing slots
- **PR:** #15 (`issue-5-conflict-resolution`)
- **Commit under test:** `ebab2e6` (Builder rebuild — AC5 copy fix in `src/components/ScheduleView.tsx`)
- **Date:** 2026-07-05
- **Verdict:** PASS — all 9 ACs green.

## What v2 verified

v1 failed a single AC: the AC5 late-late warning rendered the shared slot as
"(PMsession)" (JSX whitespace collapse). The Builder's fix renders the slot
phrase as one template literal. v2 re-ran the full gate suite from scratch in
a fresh worktree at `ebab2e6`:

| Gate | Command | Result |
|---|---|---|
| Lint | `pnpm lint` | clean (`lint.log`) |
| Unit | `pnpm test:unit` | 22/22 pass (`test-unit.log`) — includes `src/lib/conflicts.qa.test.ts` (AC4/AC8 pure-function coverage) |
| Data | `pnpm test:data` | 34/34 pass (`test-data.log`) |
| Build | `pnpm build` | success (`build.log`) |
| E2E (full) | `PORT=3100 pnpm test:e2e` | 46/46 pass (`test-e2e-full.log`) |
| E2E (issue-5 re-run for v2 evidence) | `PORT=3100 pnpm test:e2e e2e/issue-5-conflict-resolution.spec.ts` | 11/11 pass (`test-e2e-issue-5.log`) |

The previously-red AC5 exact-phrase assertion
(`e2e/issue-5-conflict-resolution.spec.ts` — "shared slot must be named
READABLY") now passes, and the close-up screenshot confirms the copy reads
"…Wednesday, May 20, 2026 (PM session)." with the space intact.

## Per-AC status (v2)

| AC | Status | Evidence |
|---|---|---|
| AC1 conflict prompt on collision (2nd selection + persisted load) | ✅ | e2e AC1 spec; `desktop.png` / `tablet.png` / `mobile.png` |
| AC2 keeper choice → each non-keeper to ITS OWN late slot + tag | ✅ | e2e AC2 spec; `ac2-moved-to-late-desktop.png` |
| AC3 persistence in `apx.resolutions.v1`; deselect clears | ✅ | e2e AC3 spec |
| AC4 3+ subjects same slot → same flow | ✅ | unit `conflicts.qa.test.ts` (no 3-way slot in shipped dataset; documented in spec header) |
| AC5 late-late collision → named warning, no overwrite / forced resolution | ✅ (fixed) | e2e AC5 spec incl. exact-phrase guard; `ac5-late-late-warning-desktop.png`, `ac5-warning-closeup-desktop.png` |
| AC6 coordinator planning-choice wording on prompt + tag | ✅ | e2e AC6 spec |
| AC7 portfolio deadlines never trigger the flow | ✅ | e2e AC7 spec; `ac7-portfolio-no-conflict-desktop.png` |
| AC8 pure functions in `src/lib/conflicts.ts` + unit tests via `pnpm test:unit` | ✅ | 22 unit tests green |
| AC9 resolved slot rendered; warning contrast ≥ 4.5:1 light + dark | ✅ | e2e AC9 spec (computed contrast assertions); `ac9-dark-prompt-desktop.png` |

## Changes made by QA in v2

- `e2e/issue-5-conflict-resolution.spec.ts`: `EVIDENCE_DIR` is now
  env-overridable (`QA_EVIDENCE_DIR`) and defaults to `issue-5-qa-v2`, so
  re-verification passes stop rewriting a prior run's committed screenshots.
  (The v2 full-suite run overwrote v1 PNGs in the worktree; they were restored
  from git before commit — v1 evidence on the branch is untouched.)
- No product-code changes. No new `[QA]` findings.

## Environment

- Fresh worktree `.worktrees/issue-5-qa` at `ebab2e6`, `pnpm install` clean.
- E2E on `PORT=3100` (3000 was occupied by an unrelated server; config honors `PORT`).
