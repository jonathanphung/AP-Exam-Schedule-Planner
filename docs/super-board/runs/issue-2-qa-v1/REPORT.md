# QA report — issue #2, v1 (PASS)

- **Issue:** #2 — Add 2026 AP exam dataset (swappable JSON) with zod schema and validation test
- **PR:** #11 · branch `issue-2-ap-2026-dataset` · Builder commit `e17c972`
- **Lane:** super-board Tester (first pass, repo-backed)
- **Date:** 2026-07-04
- **Verdict:** PASS — all 6 ACs verified

## Test plan → results (one observable check per AC)

| AC | Observable check | Where | Result |
|----|------------------|-------|--------|
| AC1 | Dataset contains exactly the 42 subjects on College Board's current course list (incl. 2 Career Kickstart), unique kebab-case ids, full entry shape enforced by strict zod schema; `exam`/`lateTesting` null only for the 6 expected subjects (3 portfolio-only Art & Design, portfolio-only AP Research, 2 Career Kickstart with sourced `noExamReason`) | `src/data/ap-2026.qa.test.ts` — "QA AC1" (4 tests) | ✅ |
| AC2 | `src/data/sources.md` exists and cites a collegeboard.org URL for each of the four data classes (exam calendar, late-testing calendar, portfolio deadlines, score distributions); JSON contains no placeholder/estimated values — unpublished fields are the literal `"pending"` | "QA AC2" (2 tests) | ✅ |
| AC3 | Anchors per PRD §8: Seminar / Research / CSP portfolio deadline `2026-04-30`; all three Art & Design portfolios `2026-05-08` with no timed exam | "QA AC3" (2 tests) | ✅ |
| AC4 | Top-level `{ cycle: "May 2026", lastVerified: <real ISO date>, sessionStartTimes: { AM: "8 a.m. …", PM: "12 p.m. …" } }` | "QA AC4" (1 test) | ✅ |
| AC5 | `schema.ts` exports zod schema + TS types; 7 independent QA negative cases: missing field, malformed session, duplicate id, regular date inside late window, late date before late window, non-kebab id, bad cycle label — all rejected | "QA AC5" (7 tests) | ✅ |
| AC6 | `pnpm test:data` exits 0 on the shipped dataset (34/34 tests); end-to-end proof that a broken entry (biology exam date 2026-06-01) makes `pnpm test:data` exit 1 | "QA AC6" (2 tests) + `negative-proof.log` | ✅ |

## Commands run (all green unless noted)

| Command | Result | Log |
|---|---|---|
| `pnpm test:data` | 34/34 PASS (2 files: Builder 16 + QA 18) | `test-data.log` |
| `npx tsc --noEmit` | clean | `typecheck-lint.log` |
| `pnpm lint` | clean | `typecheck-lint.log` |
| `pnpm test:data` with `subjects[4].exam.date = "2026-06-01"` injected | exit 1 (expected failure — proves AC6 negative path end-to-end; dataset restored byte-identical afterwards) | `negative-proof.log` |

## Notes

- **Screenshots intentionally omitted** — every AC in this issue is data/schema-level (JSON + zod + vitest); there is no UI surface to capture. Evidence is logs + this report, per the non-visual-AC rule.
- **Accepted AC1 interpretation:** the issue text says `exam`/`lateTesting` are null ONLY for portfolio-only subjects, but it also requires the Career Kickstart courses on the list and forbids projecting May 2027 dates. Those two courses have no May 2026 exam (first administration May 2027, sourced in `sources.md`). The Builder's resolution — `exam: null` + mandatory sourced `noExamReason`, enforced by the schema — is the only self-consistent reading; QA tests lock it in.
- Cross-checks against issue/PRD ground truth: 42-course list matches College Board's course index; anchor deadlines match PRD §8; spot calendar facts (Biology 5/4 AM, CS A 5/15 PM, World History late 5/18 AM, Psychology late 5/22 PM) covered by Builder tests and re-run here.

## Files added by QA

- `src/data/ap-2026.qa.test.ts` (18 tests, runs under `pnpm test:data`)
- `docs/super-board/runs/issue-2-qa-v1/` (this folder)
