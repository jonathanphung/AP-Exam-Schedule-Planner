import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_EMAIL_LENGTH,
  MAX_FEEDBACK_LENGTH,
  buildInterimIssueUrl,
  submitFeedback,
  validateEmail,
  validateMessage,
} from "./feedback";

/**
 * Unit tests for the feedback submission seam (issue #42).
 *
 * Covers the two validation rules (email is optional/unrestricted, message is
 * required + capped) and `submitFeedback`'s result handling across success,
 * transport failure, and malformed input. The dialog's DOM behaviour (focus
 * trap, pending disabling, inline aria-wired errors) runs against a real
 * browser in `e2e/issue-42-feedback-dialog.spec.ts` — this file pins the pure
 * core, mirroring the repo's lib-test convention.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validateEmail — optional and unrestricted", () => {
  it("accepts an empty / whitespace-only value (email is optional)", () => {
    expect(validateEmail("")).toEqual({ ok: true });
    expect(validateEmail("   ")).toEqual({ ok: true });
  });

  it("accepts any syntactically valid address, not just one school domain", () => {
    for (const email of [
      "student@gmail.com",
      "a.b+tag@sub.example.co.uk",
      "someone@utexas.edu",
      "x@y.zz",
    ]) {
      expect(validateEmail(email)).toEqual({ ok: true });
    }
  });

  it("rejects a syntactically invalid address", () => {
    for (const email of ["nope", "no@domain", "@no-local.com", "two@@at.com", "has space@x.com"]) {
      expect(validateEmail(email).ok).toBe(false);
    }
  });

  it("rejects an over-length address", () => {
    const tooLong = `${"a".repeat(MAX_EMAIL_LENGTH)}@example.com`;
    expect(validateEmail(tooLong).ok).toBe(false);
  });
});

describe("validateMessage — required and capped", () => {
  it("rejects empty and whitespace-only input", () => {
    expect(validateMessage("").ok).toBe(false);
    expect(validateMessage("   \n\t ").ok).toBe(false);
  });

  it("accepts real feedback", () => {
    expect(validateMessage("The conflict resolver saved me, thanks!")).toEqual({ ok: true });
  });

  it("accepts exactly the cap and rejects one over (measured after trim)", () => {
    expect(validateMessage("x".repeat(MAX_FEEDBACK_LENGTH))).toEqual({ ok: true });
    expect(validateMessage("x".repeat(MAX_FEEDBACK_LENGTH + 1)).ok).toBe(false);
    // Surrounding whitespace is trimmed before the length check.
    expect(validateMessage(`  ${"x".repeat(MAX_FEEDBACK_LENGTH)}  `)).toEqual({ ok: true });
  });
});

describe("buildInterimIssueUrl — prefilled, privacy-preserving", () => {
  it("encodes the message into the issue body", () => {
    const url = buildInterimIssueUrl({ email: "", message: "Add a print view" });
    const body = new URL(url).searchParams.get("body") ?? "";
    expect(body).toContain("Add a print view");
  });

  it("includes the reply email when given and notes its absence otherwise", () => {
    const withEmail = new URL(buildInterimIssueUrl({ email: "me@x.com", message: "hi" }))
      .searchParams.get("body")!;
    expect(withEmail).toContain("Reply to: me@x.com");

    const withoutEmail = new URL(buildInterimIssueUrl({ email: "", message: "hi" }))
      .searchParams.get("body")!;
    expect(withoutEmail).toContain("No reply email provided.");
    expect(withoutEmail).not.toContain("Reply to:");
  });

  it("carries only the form fields — no diagnostic context", () => {
    const body = new URL(buildInterimIssueUrl({ email: "me@x.com", message: "just this" }))
      .searchParams.get("body")!;
    // The body is the message + the reply line + the provenance note; nothing else.
    expect(body).toContain("just this");
    expect(body).toContain("Sent from the in-app feedback form");
  });
});

describe("submitFeedback — result handling", () => {
  it("returns ok with a notice and opens the compose surface on success", async () => {
    const open = vi.fn<(url?: string, target?: string) => Window>(() => ({ opener: {} }) as Window);
    vi.stubGlobal("window", { open });

    const result = await submitFeedback({ email: "me@x.com", message: "Great tool" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.notice).toMatch(/GitHub issue/i);
    expect(open).toHaveBeenCalledTimes(1);
    const openedUrl = String(open.mock.calls[0][0]);
    expect(openedUrl).toContain("github.com");
    // searchParams.get decodes the (`+`-encoded) body back to real spaces.
    expect(new URL(openedUrl).searchParams.get("body")).toContain("Great tool");
  });

  it("succeeds with no email (submission still proceeds)", async () => {
    const open = vi.fn<(url?: string, target?: string) => Window>(() => ({ opener: {} }) as Window);
    vi.stubGlobal("window", { open });

    const result = await submitFeedback({ email: "", message: "No email here" });

    expect(result.ok).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("reports failure (and NEVER ok) when the pop-up is blocked", async () => {
    // window.open returning null models a blocked pop-up.
    vi.stubGlobal("window", { open: vi.fn(() => null) });

    const result = await submitFeedback({ email: "", message: "blocked please" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/pop-up/i);
  });

  it("rejects malformed input before touching any transport", async () => {
    const open = vi.fn<(url?: string, target?: string) => Window>(() => ({ opener: {} }) as Window);
    vi.stubGlobal("window", { open });

    const emptyMessage = await submitFeedback({ email: "me@x.com", message: "   " });
    expect(emptyMessage.ok).toBe(false);

    const badEmail = await submitFeedback({ email: "not-an-email", message: "real feedback" });
    expect(badEmail.ok).toBe(false);

    // No transport attempt happened for either malformed submission.
    expect(open).not.toHaveBeenCalled();
  });
});
