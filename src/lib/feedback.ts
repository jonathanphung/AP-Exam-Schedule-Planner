/**
 * Feedback submission seam (issue #42).
 *
 * The whole point of this module is that the FeedbackDialog imports ONLY
 * `submitFeedback` + the `FeedbackResult` type and knows NOTHING about how the
 * message actually travels. That keeps the backend undecided (a follow-up card
 * wires Resend / a form service / a GitHub-issue proxy) without touching the
 * dialog: swap the interim adapter below and the UI is unchanged.
 *
 * Two consequences of "dialog imports nothing else about transport":
 *   - the HUMAN-READABLE outcome copy travels WITH the result (`notice` on
 *     success, `error` on failure), so the dialog never hard-codes a sentence
 *     that only makes sense for one transport. When the real backend lands it
 *     returns `notice: "Thanks — your feedback was sent."` and the dialog needs
 *     zero edits.
 *   - the dialog must not promise delivery the interim path can't guarantee.
 *     The interim adapter opens a compose surface; it does NOT deliver. Its
 *     `notice` says exactly that.
 *
 * Interim adapter — DECISION (builder, documented per the card's ask):
 *   The card offered two interim paths: a `mailto:` compose (recommended, no
 *   GitHub account needed) or a prefilled GitHub issue (if Jon "prefers no
 *   address exposure"). Shipping the **prefilled GitHub issue**, because:
 *     1. There is no receiving email endpoint yet. A `mailto:` would need a
 *        real inbox address baked into this PUBLIC client bundle — either a
 *        fabricated address that dead-ends (dishonest, the message goes
 *        nowhere) or a personal one that becomes a harvestable spam target.
 *     2. It needs no address, lands where the super-board already looks, and
 *        can be stated honestly (see the notice).
 *   Trade-off (acknowledged): posting the issue still needs a free GitHub
 *   account, so students without one aren't fully unblocked until the backend
 *   card. That is the follow-up's job — this card is frontend-only and its
 *   deliverable is the dialog + this seam. TODO(#backend): replace
 *   `openInterimIssue` with the real transport (Vercel Route Handler + Resend
 *   is the ranked-#1 option in the issue) and flip `notice` to a true
 *   delivery confirmation. No other file changes when that happens.
 *
 * Privacy (card constraint): the payload carries ONLY what the form shows — the
 * optional email and the message. Nothing about the student's selections,
 * schedules, localStorage, IP, or user-agent is attached.
 */

export const MAX_FEEDBACK_LENGTH = 2000;

/**
 * Once the message reaches this length the dialog surfaces a live character
 * counter ("…nears it", per the card). 200 shy of the cap.
 */
export const FEEDBACK_COUNTER_THRESHOLD = MAX_FEEDBACK_LENGTH - 200;

/** RFC-pragmatic upper bound on a total email address length. */
export const MAX_EMAIL_LENGTH = 254;

/** Public new-issue endpoint for the interim adapter (no auth, no secrets). */
export const REPO_NEW_ISSUE_URL =
  "https://github.com/jonathanphung/AP-Exam-Planner/issues/new";

export interface FeedbackInput {
  email: string;
  message: string;
}

/**
 * Discriminated result. The success/failure copy lives here (not in the
 * dialog) so the UI stays transport-agnostic — see the module header.
 */
export type FeedbackResult =
  | { ok: true; notice: string }
  | { ok: false; error: string };

/** Per-field validation outcome shared by the dialog (inline errors) + submit. */
export type FieldResult = { ok: true } | { ok: false; error: string };

// Deliberately permissive: a syntactically-plausible address, nothing more.
// Exactly one "@", non-empty local + domain parts, and a dotted domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email is OPTIONAL and unrestricted (the card's deliberate divergence from
 * the `@utexas.edu` reference): empty is valid. If provided it must be
 * syntactically valid and within length.
 */
export function validateEmail(raw: string): FieldResult {
  const email = raw.trim();
  if (email === "") return { ok: true };
  if (email.length > MAX_EMAIL_LENGTH) {
    return { ok: false, error: "That email address is too long." };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address, or leave it blank." };
  }
  return { ok: true };
}

/**
 * Feedback text is REQUIRED. Whitespace-only is rejected; the cap is
 * MAX_FEEDBACK_LENGTH characters (measured after trimming — the UI also caps
 * the raw field via `maxLength`, so this is a defence-in-depth guard for
 * direct `submitFeedback` callers).
 */
export function validateMessage(raw: string): FieldResult {
  const message = raw.trim();
  if (message === "") {
    return { ok: false, error: "Please enter your feedback before sending." };
  }
  if (message.length > MAX_FEEDBACK_LENGTH) {
    return {
      ok: false,
      error: `Keep your feedback to ${MAX_FEEDBACK_LENGTH.toLocaleString()} characters or fewer.`,
    };
  }
  return { ok: true };
}

/** Build the prefilled new-issue URL for the interim adapter. Pure + testable. */
export function buildInterimIssueUrl(input: FeedbackInput): string {
  const message = input.message.trim();
  const email = input.email.trim();
  const body = [
    message,
    "",
    "---",
    email ? `Reply to: ${email}` : "No reply email provided.",
    "_Sent from the in-app feedback form._",
  ].join("\n");
  const params = new URLSearchParams({ title: "App feedback", body });
  return `${REPO_NEW_ISSUE_URL}?${params.toString()}`;
}

const INTERIM_SUCCESS_NOTICE =
  "We opened a pre-filled GitHub issue in a new tab — review it and press " +
  "“Submit new issue” to post your feedback. Posting needs a free " +
  "GitHub account for now; a no-login option is on the way.";

/**
 * Test seam: lets the e2e suite hold a submission in its "pending" state long
 * enough to observe the busy UI deterministically. Inert in production — the
 * global is never set, so this is a single truthiness check with no delay, and
 * `window.open` still runs synchronously inside the click gesture.
 */
async function awaitPendingGate(): Promise<void> {
  const gate = (globalThis as { __APX_FEEDBACK_GATE__?: () => Promise<void> | void })
    .__APX_FEEDBACK_GATE__;
  if (typeof gate === "function") await gate();
}

/** INTERIM transport — see the module header's DECISION block. */
async function openInterimIssue(input: FeedbackInput): Promise<FeedbackResult> {
  await awaitPendingGate();

  if (typeof window === "undefined" || typeof window.open !== "function") {
    return { ok: false, error: "Feedback can only be sent from the browser." };
  }

  const opened = window.open(buildInterimIssueUrl(input), "_blank");
  if (!opened) {
    return {
      ok: false,
      error:
        "We couldn’t open the feedback form — your browser may have " +
        "blocked the pop-up. Allow pop-ups for this site and try again.",
    };
  }
  // Reverse-tabnabbing hardening; the new tab must not reach back into ours.
  try {
    opened.opener = null;
  } catch {
    // Cross-origin proxy may refuse the write once navigated; harmless.
  }
  return { ok: true, notice: INTERIM_SUCCESS_NOTICE };
}

/**
 * THE seam. Validates, then routes through the (currently interim) transport.
 * The dialog imports only this + `FeedbackResult`.
 */
export async function submitFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const emailResult = validateEmail(input.email);
  if (!emailResult.ok) return emailResult;

  const messageResult = validateMessage(input.message);
  if (!messageResult.ok) return messageResult;

  return openInterimIssue(input);
}
