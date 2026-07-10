import { describe, expect, it } from "vitest";
import { scrollLockCompensationPx } from "./modal";

/**
 * Issue #49 — pure core of the scroll-lock width compensation.
 *
 * The hook samples `documentElement.clientWidth` before and after applying
 * `overflow: hidden` and passes both here; the return value is the
 * padding-right the body needs while scroll is locked. The DOM shell (root +
 * body overflow mutation, restore-on-unmount, the `scrollbar-gutter: stable`
 * CSS primary path) is exercised end-to-end by the Playwright suite
 * `e2e/issue-49-scrollbar-gutter.spec.ts`, matching how the other lib stores
 * split pure core vs browser shell.
 */
describe("scrollLockCompensationPx", () => {
  it("returns 0 when the reserved gutter held the width (CSS owns the fix)", () => {
    // Classic scrollbar present, but `scrollbar-gutter: stable` kept the
    // viewport at the same client width after `overflow: hidden`.
    expect(scrollLockCompensationPx(1903, 1903)).toBe(0);
  });

  it("returns the freed scrollbar width when the lock widened the viewport", () => {
    // Browser without a working `scrollbar-gutter` under the lock (Chromium,
    // Safari < 18.2) with our ::-webkit-scrollbar styling forcing classic
    // mode: hiding overflow removes the scrollbar and the viewport gains its
    // width back.
    expect(scrollLockCompensationPx(1903, 1920)).toBe(17);
    expect(scrollLockCompensationPx(365, 375)).toBe(10);
  });

  it("returns 0 for overlay scrollbars (widths match — nothing to compensate)", () => {
    expect(scrollLockCompensationPx(1920, 1920)).toBe(0);
  });

  it("never returns a negative compensation", () => {
    // Defensive: zoom/rounding artifacts must not produce negative padding.
    expect(scrollLockCompensationPx(1920, 1919)).toBe(0);
  });
});
