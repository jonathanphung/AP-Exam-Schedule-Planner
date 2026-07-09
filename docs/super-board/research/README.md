# College Board exam-structure re-source — May 2026 cycle

Fetched **2026-07-09** from AP Central's course exam pages
(`https://apcentral.collegeboard.org/courses/ap-<slug>/exam`), with
`https://apstudents.collegeboard.org/courses/ap-<slug>/assessment` as a second
opinion. One fetch agent plus one **independent refute-skeptic** per subject;
the skeptic's job was to disprove each number against the live page, with
"false pending" (a value marked unpublished that is in fact printed) as the
specific defect being hunted.

- `collegeboard-2026/<id>.json` — one record per subject, with the verbatim
  page text behind every value.
- `collegeboard-2026-consolidated.json` — all 42, merged.

## Why this exists

Issue #38's rework audited only the **AP Students assessment page**, which for
most subjects prints the total exam duration and the section score weights but
**not** the per-section times. It concluded that 25 of 42 subjects had
genuinely unpublished section timings. **AP Central publishes them.**

The tell was already in the data: `calculus-bc` carried `mcqMinutes: 105`
while `calculus-ab` — the same 195-minute exam, same section shape — sat at
`"pending"`. That asymmetry reflected which page happened to state the number,
not what College Board publishes.

## What the sweep found

**17 subjects rescued from a false `"pending"`**, plus four more surfaced by
the skeptics (AP African American Studies' free-response total is printed as
`4 Questions 1hr 25mins`; AP Japanese's full exam-components block is on the
very page a fetcher reported as lacking one).

**Seven subjects cannot be represented by the current flat
`mcqCount`/`frqCount`/`mcqMinutes`/`frqMinutes` model at all** — College Board
prints them as three or more separately-timed sections:

| subject | sections |
|---|---|
| `african-american-studies` | 5 |
| `world-history-modern` | 3 |
| `united-states-history` | 3 |
| `spanish-literature-and-culture` | 3 |
| `music-theory` | 3 |
| `european-history` | 3 |
| `business-with-personal-finance` | 3 |

Fifteen more publish **Part A / Part B** splits with their own times and tool
rules (Calculus AB's no-calculator vs. graphing-calculator halves; the language
exams' Listening vs. Reading parts).

Squeezing these into two flat fields forces a fabricated aggregate — the
skeptics correctly flagged `frqCount: 9` for AP Music Theory (the page prints
`7 questions` and `2 questions` in two separate sections; `9` appears nowhere)
and `frqCount: 5` for AP African American Studies. **Summing published
sub-parts into a parent total the page never prints is the same class of error
as back-computing from the total**, and the hard data rule (PRD §7.5/§8/§11)
forbids both.

## Dataset corrections this sweep proves

Independently re-verified by hand, not just by the agents:

| subject | field | dataset ships | College Board prints |
|---|---|---|---|
| `statistics` | `mcqCount` / `frqCount` | 40 / 6 | **42 / 4** |
| `french-language-and-culture` | `mcqCount` / `frqCount` | 65 / 4 | **55 / 3** |
| `german-language-and-culture` | `mcqCount` / `frqCount` | 65 / 4 | **55 / 3** |
| `italian-language-and-culture` | `mcqCount` / `frqCount` | 65 / 4 | **55 / 3** |
| `spanish-language-and-culture` | `mcqCount` / `frqCount` | 65 / 4 | **55 / 3** |
| `chinese-language-and-culture` | `mcqCount` | `"55–75"` | **55** |
| `japanese-language-and-culture` | `mcqCount` | `"60–75"` | **55** |

`french-language-and-culture` additionally ships `totalMinutes: 180`, which
College Board does not print anywhere; its published sections sum to ~145–150.
`african-american-studies` ships `totalMinutes: 165`, which the AP Students
page **does** print (`2hrs 45mins`) — that one is correct, but it was correct
by accident, having been reachable only as a sum in the primary source.

## Rules the records obey

- Every populated value is quoted from the page it came from.
- `"pending"` means College Board does not print it. A section the exam does
  not have is absent, never `"pending"` — omission and non-publication are
  different states.
- No value is estimated, back-computed from a total, or summed from sub-parts
  into a parent the page never prints.
