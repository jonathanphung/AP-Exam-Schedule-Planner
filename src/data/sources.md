# Data sources for `ap-2026.json`

Every value in `ap-2026.json` was taken from a College Board page fetched on
**2026-07-04** (the file's `lastVerified` date). Nothing is estimated; any
value College Board has not published is the literal string `"pending"`
(PRD §7.5/§8/§11).

## The four data classes (issue #2 AC)

| Data class | Exact URL used |
|---|---|
| Exam calendar (regular dates + AM/PM sessions + session start times) | <https://apcentral.collegeboard.org/exam-administration-ordering-scores/exam-dates> |
| Late-testing calendar | <https://apcentral.collegeboard.org/exam-administration-ordering-scores/exam-dates/late-testing-dates> |
| Portfolio deadlines | <https://apcentral.collegeboard.org/about-ap/ap-coordinators/calendar-deadlines> (Apr 30, 2026 11:59 p.m. ET for AP Seminar / AP Research / AP CSP performance tasks; May 8, 2026 8 p.m. ET for AP Art and Design portfolios — the Art and Design deadline is also stated on the exam-dates page above) |
| Score distributions (pass rates) | <https://apstudents.collegeboard.org/about-ap-scores/score-distributions> |

### Notes on the score distributions

The issue expected the 2025 administration to be the most recent published
data. As of 2026-07-04 College Board's score-distributions page already
carries the **2026 administration** results for all subjects (released on a
rolling basis in July 2026), so `passRate` is the published "3+" percentage
from the 2026 tables — the most recent published data, per the AC. The two
Career Kickstart courses have no administrations yet and are `"pending"`.

## Session start times

The exam-calendar tables label sessions "Morning 8 a.m. Local Time" and
"Afternoon 12 p.m. Local Time"; the same page states exams must begin between
8–9 a.m. / 12–1 p.m. local time. `sessionStartTimes` records the published
labels verbatim.

## Exam format, delivery mode, and calculator policy (per-subject)

- Delivery mode (fully digital / hybrid / not delivered through Bluebook):
  <https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/digital-ap-exams/exam-modes>
  - "digital" = fully digital in Bluebook, portfolio-only subjects submitted
    through the AP Digital Portfolio, and the AP Chinese/Japanese exams
    (administered on school devices through a separate exam application).
  - "hybrid" = MCQ in Bluebook + handwritten free response.
  - "paper" = paper exam booklets (French/German/Italian/Spanish Language,
    Music Theory, Spanish Literature), per the same page.
- Calculator policy (which exams allow calculators; all others prohibit them):
  <https://apstudents.collegeboard.org/exam-policies-guidelines/calculator-policies>
- Question counts, section timing, and exam duration: each course's official
  pages, fetched per subject —
  - AP Central "Exam" pages: `https://apcentral.collegeboard.org/courses/<slug>/exam`
    (e.g. `ap-biology`, `ap-calculus-ab`, `ap-physics-1`, `ap-world-history`,
    `ap-seminar`, `ap-research`)
  - AP Students "Assessment" pages (published "Exam Duration" and exam-date
    cross-check): `https://apstudents.collegeboard.org/courses/<slug>/assessment`
    (e.g. `ap-biology`, `ap-music-theory`, `ap-cybersecurity`,
    `ap-business-personal-finance`)
  - `totalMinutes` is the published "Exam Duration" from the AP Students
    assessment page (e.g. Biology "3hrs" → 180; Cybersecurity "2hrs 10mins"
    → 130). The `questionCount` type also accepts a published range string
    (`"55–75"`) for cycles where College Board prints an adaptive range, though
    **no subject currently uses one** after the 2026-07-09 re-source — see
    "2026 digital-redesign question-count corrections" below, which moved AP
    Chinese and AP Japanese to fixed counts.
- Portfolio component weights (`weightPct`):
  - AP Seminar 20% + 35% = 55% through-course performance tasks:
    <https://apcentral.collegeboard.org/courses/ap-seminar/exam>
  - AP Research 100% through-course performance task:
    <https://apcentral.collegeboard.org/courses/ap-research/exam>
  - AP CSP Create performance task + written responses 30%:
    <https://apcentral.collegeboard.org/courses/ap-computer-science-principles/exam>
  - AP Art and Design sustained investigation 60% + selected works 40%:
    <https://apstudents.collegeboard.org/courses/ap-drawing/assessment>

## 2026 digital-redesign question-count corrections (issue #45, re-sourced 2026-07-09)

The initial 2026-07-04 fill carried **pre-redesign** question counts for seven
subjects. They were re-sourced on **2026-07-09** from each course's AP Central
exam page (`https://apcentral.collegeboard.org/courses/ap-<slug>/exam`),
adversarially verified (one fetch agent + one independent refute-skeptic per
subject), and re-checked by hand. Verbatim page text for all 42 subjects is
committed under `docs/super-board/research/collegeboard-2026/` (see that
folder's `README.md`); each subject below cites its file.

| subject | field | was | now | verbatim source quote |
|---|---|---|---|---|
| `statistics` | `mcqCount` | 40 | **42** | "Section I: Multiple Choice — 42 Questions \| 1 Hour 30 Minutes \| 50% of Exam Score" |
| `statistics` | `frqCount` | 6 | **4** | "Section II: Free Response — 4 Questions \| 1 Hour 30 Minutes \| 50% of Exam Score" |
| `french-language-and-culture` | `mcqCount` | 65 | **55** | "Section II: Multiple-Choice — 55 Questions \| 80 Minutes \| 50% of Score" |
| `french-language-and-culture` | `frqCount` | 4 | **3** | "Section I: Free-Response — 3 Questions \| 65–70 Minutes \| 50% of Score" |
| `german-language-and-culture` | `mcqCount` | 65 | **55** | "Section II: Multiple-Choice — 55 Questions \| 80 Minutes \| 50% of Score" |
| `german-language-and-culture` | `frqCount` | 4 | **3** | "Section I: Free-Response — 3 Questions \| 65–70 Minutes \| 50% of Score" |
| `italian-language-and-culture` | `mcqCount` | 65 | **55** | "55 Questions \| 80 Minutes \| 50% of Score" |
| `italian-language-and-culture` | `frqCount` | 4 | **3** | "3 Questions \| 65–70 Minutes \| 50% of Score" |
| `spanish-language-and-culture` | `mcqCount` | 65 | **55** | "Section II: Multiple-Choice — 55 Questions \| 80 Minutes \| 50% of Score" |
| `spanish-language-and-culture` | `frqCount` | 4 | **3** | "Section I: Free-Response — 3 Questions \| 65–70 Minutes \| 50% of Score" |
| `chinese-language-and-culture` | `mcqCount` | `"55–75"` | **55** | "Section II: Multiple-Choice — 55 Questions \| 65 Minutes \| 50% of Score" |
| `japanese-language-and-culture` | `mcqCount` | `"60–75"` | **55** | "Section II: Multiple Choice — 55 questions — 50% of Score (Part A: Listening 25 + Part B: Reading 30)" |

The `"55–75"` / `"60–75"` ranges for Chinese and Japanese described the older
adaptive-listening format; the current pages print a fixed **55** (25 listening
+ 30 reading). AP Statistics moved to 42 MCQ / 4 FRQ and AP French/German/
Italian/Spanish now open with a spoken project presentation, dropping Section I
to 3 free-response questions.

### `frqType` re-descriptions (kept consistent with the corrected `frqCount`)

`frqType` renders directly beneath `frqCount` in `InfoPanel`, so a corrected
count with a stale description would render a self-contradiction. Where the
count changed, `frqType` was re-sourced from the same page:

- `french/german/italian/spanish-language-and-culture`: `"2 written tasks + 2
  spoken tasks"` → **`"1 written task + 2 spoken tasks"`** — the three published
  free-response questions are Project Presentation (spoken), Project Q&A
  (spoken), and Argumentative Essay (written).
- `statistics`: `"6 free-response questions (5 multipart questions + 1
  investigative task)"` → **`"3 multi-part questions + 1 inference question
  (hypothesis test or confidence interval)"`** — the pre-redesign "investigative
  task" was dropped and the count fell to 4. Both College Board pages publish a
  per-question breakdown of Section II, so the composition is sourced, not
  pending. AP Central
  (`apcentral.collegeboard.org/courses/ap-statistics/exam`): "Question 1:
  Multi-Focus on Practices 1 and 2 / Question 2: Multi-Focus on Practices 3 and
  4 / Question 3: Inference (Hypothesis Test or Confidence Interval) / Question
  4: Multi-Focus on Practices 2, 3, and 4". AP Students
  (`apstudents.collegeboard.org/courses/ap-statistics/assessment`): "Question 1
  is a multi-part question that primarily assesses Practices 1 and 2. Question 2
  is a multi-part question that primarily assesses Practices 3 and 4. Question 3
  focuses on inference, assessing the inference skills associated with Practices
  2, 3, and 4. Question 4 is a multi-part question with a focus on multiple
  course content areas, assessing Practices 2, 3, and 4." Questions 1, 2, and 4
  are the three multi-part / multi-focus questions; Question 3 is the inference
  question. Every term in the stored composition ("multi-part", "inference",
  "hypothesis test or confidence interval") is verbatim page language; the
  redesigned exam prints no "investigative task".
- `chinese/japanese-language-and-culture`: unchanged — `frqCount` stays 4 and
  the four questions remain 2 spoken (Presentation, Q&A) + 2 written (Story
  Narration, Email Response), so `"2 written tasks + 2 spoken tasks"` is correct.

### Exam durations (`totalMinutes`) — AP Central omits the total, AP Students omits section times

The two College Board pages are **complementary**:
`apcentral.collegeboard.org/courses/ap-<slug>/exam` prints each section's timing
and weight but, for most subjects, **no overall exam total**;
`apstudents.collegeboard.org/courses/ap-<slug>/assessment` prints the overall
**`Exam Duration`** but **no per-section times**. A duration absent from AP
Central is therefore *not* unpublished — it is on AP Students. `totalMinutes` is
sourced from the AP Students `Exam Duration`; the per-section splits come from AP
Central. (Recorded because the first re-source consulted only AP Central,
mislabelled published totals `"pending"`, and this card's first build then
overwrote four correct durations with that false `"pending"`. The provenance was
re-sourced and patched at commit `171cb15`; every sit-down subject now carries
`totalMinutesStated` / `totalMinutesVerbatim` / `totalMinutesSource`.)

The six language exams' `totalMinutes` are the published AP Students
`Exam Duration`:

| subject | totalMinutes | AP Students `Exam Duration` (verbatim) | source |
|---|---|---|---|
| `french-language-and-culture` | **150** | "Approximately 2hrs 30mins" | <https://apstudents.collegeboard.org/courses/ap-french-language-and-culture/assessment> |
| `german-language-and-culture` | **150** | "Approximately 2hrs 30mins" | <https://apstudents.collegeboard.org/courses/ap-german-language-and-culture/assessment> |
| `italian-language-and-culture` | **150** | "Approximately 2hrs 30mins" | <https://apstudents.collegeboard.org/courses/ap-italian-language-and-culture/assessment> |
| `spanish-language-and-culture` | **150** | "Approximately 2hrs 30mins" | <https://apstudents.collegeboard.org/courses/ap-spanish-language-and-culture/assessment> |
| `chinese-language-and-culture` | **120** | "Approximately 2hrs" | <https://apstudents.collegeboard.org/courses/ap-chinese-language-and-culture/assessment> |
| `japanese-language-and-culture` | **120** | "Approximately 2hrs" | <https://apstudents.collegeboard.org/courses/ap-japanese-language-and-culture/assessment> |

French/German/Italian/Spanish shipped a wrong `180`/`183` in production and are
corrected to the published **150**. Chinese/Japanese were already correct at
**120**; this card's first build wrote `"pending"` over them and that is now
reverted. `statistics.totalMinutes` stays **180** ("3hrs", `statistics.json`),
unchanged — both its 90-minute sections and its overall total are published.
Every other subject's `totalMinutes` was verified subject-by-subject to already
equal its patched `totalMinutesStated`, so **no other subject was touched**. The
four portfolio-only subjects (`research`, `drawing`, `2-d-art-and-design`,
`3-d-art-and-design`) have no sit-down exam and keep `0`.

### Design decision — approximate durations stored as the rounded integer; hedge dropped

Four of the six totals are printed with a hedge ("Approximately 2hrs 30mins",
"Approximately 2hrs") and the provenance flags each `totalMinutesApproximate:
true`. The schema stores `totalMinutes` as an integer and this card makes **no
schema change**, so the hedge is **dropped in the data layer**: French is stored
as `150` and `InfoPanel` renders "2 hr 30 min" with no "about". This is
deliberate. Surfacing the hedge in the UI ("about 2 hr 30 min") or carrying a
per-value approximate flag is a schema + `InfoPanel` change that belongs with
#44's duration model, not a count-fix card. The hedge is not lost — it is kept
verbatim in `totalMinutesVerbatim` / `totalMinutesApproximate` in the provenance
for whoever builds that UI.

### Scope deliberately held to these seven subjects

Two categories were **intentionally not touched** here:

1. **The seven 3+-section subjects** — `african-american-studies`,
   `european-history`, `united-states-history`, `world-history-modern`,
   `music-theory`, `spanish-literature-and-culture`,
   `business-with-personal-finance`. Their provenance shows separately-timed
   Part A/B or third sections (e.g. Music Theory free response "7 + 2", US
   History free response "2"), which the flat `mcqCount`/`frqCount` model
   cannot express. That is issue #44's `sections[]` work, not a count fix —
   forcing a flat number here would fabricate an aggregate the page never
   prints. Left unchanged.
2. **Per-section timing splits** — the provenance carries Part A/B and
   per-question `minutes` for many subjects (e.g. the language exams' 80-minute
   MCQ = 40 listening + 40 reading) that the flat `mcqMinutes`/`frqMinutes`
   schema cannot express; those splits belong to #44's `sections[]` model. Note:
   after the `171cb15` provenance patch every sit-down subject's **overall**
   `totalMinutes` is published and correct here — including `microeconomics`
   (130) and `psychology` (160), earlier believed unsourced but in fact printed
   as the AP Students `Exam Duration`. Only the intra-section splits remain #44's
   job.

### Design decision — keep the range type in `questionCount`

After these corrections **no subject uses a range** for `mcqCount`/`frqCount`
(Chinese and Japanese moved to the fixed 55). The `questionCount` union in
`schema.ts` still accepts a published range string (`/^\d+–\d+$/`). It is
**kept**, not removed: (a) the issue constrains this card to "no schema change";
(b) College Board has printed adaptive ranges before and may again in a future
cycle, so retaining the type keeps the model able to represent a published range
without a schema migration. The data test below pins the seven counts as exact
integers so a future re-source cannot silently regress them back to a range.

## Course list (42 subjects, including Career Kickstart)

<https://apstudents.collegeboard.org/course-index-page> — "Find course and
exam information for 42 AP subjects." The list includes the two AP Career
Kickstart courses (AP Business with Personal Finance, AP Cybersecurity).

### Career Kickstart courses have no May 2026 exam

Both courses' assessment pages state: "Note: The 2027 AP Exam dates will be
available in summer 2026" — their first end-of-course exams are in May 2027
(<https://apstudents.collegeboard.org/courses/ap-cybersecurity/assessment>,
<https://apstudents.collegeboard.org/courses/ap-business-personal-finance/assessment>).
They are therefore listed with `exam: null`, `lateTesting: null`, a sourced
`noExamReason`, and `passRate: "pending"`. Their published exam formats (for
the 2027 first administration) are included as College Board publishes them
today.

## Official course/exam pages (issue #22 — Tier 3 links)

The UI links each subject to its official College Board page from
`src/lib/college-board-links.ts` (the single source of truth for these URLs —
no scattered hardcoded strings). The pattern is
`https://apcentral.collegeboard.org/courses/ap-<id>/exam`, where `<id>` is the
dataset subject id. **Every linked URL was individually verified with an
HTTP request on 2026-07-07**: 37 of the 42 subjects returned 200 from the
patterned URL (including AP Cybersecurity, whose exam page exists ahead of
its May 2027 first administration). Five subjects do not follow the pattern
and carry an individually verified exception URL instead:

| Subject id | Verified official page | Why the pattern fails |
|---|---|---|
| `business-with-personal-finance` | <https://apcentral.collegeboard.org/courses/ap-business-personal-finance/exam> | College Board's slug drops "with" |
| `world-history-modern` | <https://apcentral.collegeboard.org/courses/ap-world-history/exam> | official page has no "-modern" suffix |
| `2-d-art-and-design` | <https://apcentral.collegeboard.org/courses/ap-2-d-art-and-design/portfolio> | portfolio-only course — no `/exam` page |
| `3-d-art-and-design` | <https://apcentral.collegeboard.org/courses/ap-3-d-art-and-design/portfolio> | portfolio-only course — no `/exam` page |
| `drawing` | <https://apcentral.collegeboard.org/courses/ap-drawing/portfolio> | portfolio-only course — no `/exam` page |

Per the data rule, an unverifiable link is omitted (the helper returns
`null`), never guessed. A unit test (`src/lib/college-board-links.test.ts`)
pins full coverage for every shipped subject, so an id added to a future
dataset without re-verification fails CI instead of shipping a guessed link.

## Annual swap (PRD §8)

The May 2027 calendar is unpublished — no 2027 dates are projected anywhere
in the dataset. When College Board posts the 2027 schedule (summer 2026),
swap this JSON for a new `ap-2027.json` and update the window constants in
`schema.ts`.
