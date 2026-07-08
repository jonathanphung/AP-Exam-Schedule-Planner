"use client";

import { useState } from "react";
import {
  RESOURCE_GROUPS,
  headingId,
  resolveLabel,
  type ResourceLink,
} from "@/data/resources";
import { MySchedules } from "@/components/MySchedules";
import { toggleSidebarCollapsed, useSidebarCollapsed } from "@/lib/sidebar";

/**
 * App sidebar (issue #29) — grown from the Resources sidebar (#23/#25) into a
 * branded app panel modeled on the UT Registration Plus reference:
 *
 *   1. Branding row — the app mark + "AP Exam Planner" (the page's single h1)
 *      with a collapse/expand toggle on the right (desktop only).
 *   2. MY SCHEDULES — the multi-schedule switcher (see MySchedules.tsx).
 *   3. Divider.
 *   4. RESOURCES — the #23/#25 curated official links, content unchanged
 *      (links-only per the earlier bounce), with #29's presentation polish:
 *      every label fits on one line, and hovering underlines the text but
 *      never the trailing ↗.
 *
 * Presentation:
 *   • Desktop (≥1024px / `lg`): a persistent left column (18rem when
 *     expanded). The collapse toggle (`aria-expanded`, keyboard-operable)
 *     shrinks it to a slim rail so the main content widens; the choice is
 *     remembered client-side in `apx.sidebar.v1`. Builder's documented call:
 *     the toggle exists only where the persistent column exists (desktop) —
 *     tablet (<1024px) uses the mobile presentation, which has nothing to
 *     collapse.
 *   • Mobile/tablet (<1024px): no persistent left column (the #22/#23
 *     pattern). Branding renders at the top of the panel card, and MY
 *     SCHEDULES and RESOURCES are separate native disclosures, collapsed by
 *     default to keep the planner above the fold.
 *
 * The schedule list and the link list are each rendered ONCE from their
 * single source of truth; CSS decides which heading presentation (plain vs.
 * disclosure trigger) is visible per viewport, so assistive tech only ever
 * encounters one copy.
 */

function ExternalResourceLink({ link }: { link: ResourceLink }) {
  const label = resolveLabel(link.label);
  return (
    <li className="leading-snug">
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex max-w-full items-baseline gap-1 rounded-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300 dark:hover:text-blue-200 dark:focus-visible:outline-blue-400"
      >
        {/* Underline lives on the label span only, so the trailing ↗ never
            underlines on hover (issue #29 link polish). `truncate` guards the
            one-label-one-line rule; labels are sized to fit un-truncated. */}
        <span className="truncate underline-offset-2 group-hover:underline group-focus-visible:underline">
          {label}
        </span>
        <span aria-hidden="true">↗</span>
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </li>
  );
}

function ResourceGroups() {
  return (
    <div className="flex flex-col gap-5">
      {RESOURCE_GROUPS.map((group) => {
        const id = headingId(group.heading);
        return (
          <section key={group.heading} aria-labelledby={id}>
            <h3
              id={id}
              className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100"
            >
              {group.heading}
            </h3>
            <ul className="mt-2 flex flex-col gap-2">
              {group.links.map((link) => (
                <ExternalResourceLink key={link.href} link={link} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function DisclosureChevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Shared styling for the mobile disclosure trigger buttons. */
const DISCLOSURE_BUTTON_CLASS =
  "flex min-h-11 w-full items-center justify-between gap-2 rounded-sm text-xs font-semibold uppercase tracking-wider text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-slate-300 dark:focus-visible:outline-blue-400";

/** Shared styling for the always-visible desktop section headings. */
const DESKTOP_HEADING_CLASS =
  "hidden text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 lg:block";

export function Sidebar() {
  // Desktop collapse — remembered client-side (src/lib/sidebar.ts): expanded
  // on the server and the first client render, the stored choice right after
  // mount.
  const collapsed = useSidebarCollapsed();
  // Mobile disclosures — collapsed by default (#23 behavior, kept for #29).
  const [schedulesOpen, setSchedulesOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);

  return (
    <aside
      aria-label="App panel"
      data-testid="resources-sidebar"
      className={[
        "w-full rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40",
        "lg:shrink-0 lg:self-start lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:dark:bg-transparent",
        // w-80 expanded: sized so the longest resource label (with its ↗)
        // fits on ONE line at desktop widths (issue #29 link polish).
        collapsed ? "lg:w-10" : "lg:w-80",
      ].join(" ")}
    >
      {/* 1 — Branding row: app mark + name (the page's single h1) + collapse
          toggle. When collapsed on desktop the text is sr-only, so the
          document keeps its h1 and the rail shows just the toggle. */}
      <div className="flex items-start justify-between gap-2">
        <div
          className={`flex min-w-0 items-center gap-2.5 ${collapsed ? "lg:sr-only" : ""}`}
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-sm font-bold tracking-tight text-white dark:bg-blue-500 dark:text-slate-950"
          >
            AP
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight tracking-tight">
              AP Exam Planner
            </h1>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Find your AP subjects and build your &ldquo;My Exams&rdquo; list.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          aria-expanded={!collapsed}
          aria-controls="sidebar-sections"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:focus-visible:outline-blue-400"
        >
          {collapsed ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      </div>

      <div
        id="sidebar-sections"
        className={collapsed ? "mt-5 lg:hidden" : "mt-5"}
      >
        {/* 2 — MY SCHEDULES */}
        <section aria-labelledby="my-schedules-heading">
          <h2 id="my-schedules-heading" className={DESKTOP_HEADING_CLASS}>
            My schedules
          </h2>
          <h2 className="m-0 lg:hidden">
            <button
              type="button"
              aria-expanded={schedulesOpen}
              aria-controls="my-schedules-panel"
              onClick={() => setSchedulesOpen((open) => !open)}
              className={DISCLOSURE_BUTTON_CLASS}
            >
              <span>My schedules</span>
              <DisclosureChevron open={schedulesOpen} />
            </button>
          </h2>
          <div
            id="my-schedules-panel"
            className={`${schedulesOpen ? "block" : "hidden"} mt-2 lg:mt-3 lg:block`}
          >
            <MySchedules />
          </div>
        </section>

        {/* 3 — Divider */}
        <hr className="my-5 border-slate-200 dark:border-slate-800" />

        {/* 4 — RESOURCES (#23/#25 content unchanged; #29 polish on links) */}
        <h2 className={DESKTOP_HEADING_CLASS}>Resources</h2>
        <p className="mt-1 hidden text-xs text-slate-600 dark:text-slate-400 lg:block">
          Official College Board pages. Each opens in a new tab.
        </p>
        <h2 className="m-0 lg:hidden">
          <button
            type="button"
            aria-expanded={resourcesOpen}
            aria-controls="resources-panel"
            onClick={() => setResourcesOpen((open) => !open)}
            className={DISCLOSURE_BUTTON_CLASS}
          >
            <span>Resources</span>
            <DisclosureChevron open={resourcesOpen} />
          </button>
        </h2>
        <div
          id="resources-panel"
          className={`${resourcesOpen ? "block" : "hidden"} mt-2 lg:mt-4 lg:block`}
        >
          <ResourceGroups />
        </div>
      </div>
    </aside>
  );
}
