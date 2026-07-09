import { describe, expect, it } from "vitest";
import {
  nextPreference,
  parsePreference,
  resolveTheme,
  type ThemePreference,
} from "./theme";

/**
 * Unit tests for the theme store's pure core (issue #41).
 *
 * Like `schedules.test.ts`, these pin the deterministic state machine —
 * preference parsing (incl. malformed → System), preference → resolved theme
 * (the `system` branch keyed off the OS `prefers-color-scheme`), and the
 * cycling order. The store shell (localStorage persistence, the pre-paint
 * apply, live `matchMedia` system-change handling, the `.dark`/`color-scheme`
 * writes, the React hook) runs against a real browser in the Playwright suite
 * (`e2e/issue-41-theme-toggle.spec.ts`), which is where "persistence across
 * reload" and "System follows an emulated OS change" are observably verified.
 */

describe("parsePreference — malformed stored values degrade to System", () => {
  it("accepts the three valid preferences verbatim", () => {
    expect(parsePreference("light")).toBe("light");
    expect(parsePreference("dark")).toBe("dark");
    expect(parsePreference("system")).toBe("system");
  });

  it("treats a missing value (null) as System (first-visit default)", () => {
    expect(parsePreference(null)).toBe("system");
  });

  it("degrades any malformed / unknown value to System, never throws", () => {
    for (const raw of ["", "System", "LIGHT", "Dark", "auto", "0", "{}", "null"]) {
      expect(parsePreference(raw)).toBe("system");
    }
  });
});

describe("resolveTheme — preference + OS state → concrete theme", () => {
  it("honors an explicit light/dark regardless of the OS setting", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the OS in System mode", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("nextPreference — cycling order light → dark → system → light", () => {
  it("advances one step and wraps", () => {
    expect(nextPreference("light")).toBe("dark");
    expect(nextPreference("dark")).toBe("system");
    expect(nextPreference("system")).toBe("light");
  });

  it("returns to the start after three steps", () => {
    let p: ThemePreference = "system";
    const seen: ThemePreference[] = [];
    for (let i = 0; i < 3; i += 1) {
      p = nextPreference(p);
      seen.push(p);
    }
    expect(seen).toEqual(["light", "dark", "system"]);
  });
});
