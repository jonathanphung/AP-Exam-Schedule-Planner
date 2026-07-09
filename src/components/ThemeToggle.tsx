"use client";

import { useState } from "react";
import { useTheme, type ThemePreference } from "@/lib/theme";

/**
 * Theme toggle (issue #41) — a three-state control living in the sidebar
 * footer's icon cluster, beside the GitHub mark, at the same icon size.
 *
 * Design decision (the issue asked the builder to pick a shape and justify):
 * a **cycling icon button** (Light → Dark → System → …), not a popover menu.
 * Rationale — the placement is explicitly "an icon among icons" in the
 * bottom-of-sidebar utility corner, and it must also survive in the collapsed
 * desktop rail (a ~40px-wide column with no room for a menu trigger + panel).
 * A single button is the only shape that fits both presentations without
 * adding visual weight or a portal/focus-trap. The two discoverability risks
 * of a cycling control are mitigated head-on:
 *   • current state is always legible — the glyph *is* the current preference
 *     (sun = Light, moon = Dark, monitor = System), not a generic toggle;
 *   • the third state isn't hidden — the accessible name names it ("Theme:
 *     System (follows your device). Change theme.") and the polite live region
 *     announces each new state on activation for screen-reader users.
 *
 * Accessibility (the #8 bar): a real <button> with an accessible name that
 * conveys current state AND action; the icon is decorative (aria-hidden); a
 * ≥44×44px touch target on mobile (h-11 w-11, relaxed to h-9/w-9 at `lg` like
 * the sibling GitHub control); visible focus ring; AA contrast in both themes
 * (identical color classes to the approved GitHub icon). No theme-transition
 * animation is added anywhere, so `prefers-reduced-motion` is honored by
 * construction — flipping the theme repaints instantly with no motion.
 */

const LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System (follows your device)",
};

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <circle cx="10" cy="10" r="3.25" />
      <path d="M10 2.25v1.5M10 16.25v1.5M2.25 10h1.5M16.25 10h1.5M4.6 4.6l1.05 1.05M14.35 14.35l1.05 1.05M15.4 4.6l-1.05 1.05M5.65 14.35l-1.05 1.05" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5"
    >
      <path d="M15.5 12.4a6 6 0 0 1-7.9-7.9.75.75 0 0 0-.98-.98A7.5 7.5 0 1 0 16.5 13.4a.75.75 0 0 0-.98-.98Z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <rect x="2.5" y="4" width="15" height="9.5" rx="1.75" />
      <path d="M7 17h6M10 13.5V17" />
    </svg>
  );
}

function PreferenceIcon({ preference }: { preference: ThemePreference }) {
  if (preference === "light") return <SunIcon />;
  if (preference === "dark") return <MoonIcon />;
  return <MonitorIcon />;
}

export function ThemeToggle() {
  const { preference, cycle } = useTheme();
  // Announcement is empty until the user acts, so nothing is read on load;
  // each activation updates it and the polite live region reads the new state.
  const [announcement, setAnnouncement] = useState("");

  const label = LABELS[preference];

  return (
    <>
      <button
        type="button"
        data-testid="theme-toggle"
        onClick={() => {
          const next = cycle();
          setAnnouncement(`Theme: ${LABELS[next]}.`);
        }}
        aria-label={`Theme: ${label}. Change theme.`}
        title={`Theme: ${label}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:h-9 lg:w-9 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:focus-visible:outline-blue-400"
      >
        <PreferenceIcon preference={preference} />
      </button>
      {/* Announce the new state on activation (issue #41 a11y AC). Visually
          hidden; polite so it doesn't interrupt. */}
      <span aria-live="polite" className="sr-only" data-testid="theme-announcement">
        {announcement}
      </span>
    </>
  );
}
