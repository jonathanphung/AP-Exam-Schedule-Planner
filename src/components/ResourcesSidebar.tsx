"use client";

import { useState } from "react";
import {
  RESOURCE_GROUPS,
  headingId,
  resolveLabel,
  type ResourceLink,
} from "@/data/resources";

/**
 * Resources sidebar (#23).
 *
 * Renders the curated official College Board links inside the main app rather
 * than on a dedicated route (per Jon's design bounce on PR #25 — resources live
 * beside the planner content like the reference sidebar, not on a separate page).
 *
 * Presentation:
 *   • Desktop (≥1024px / `lg`): a persistent left column, always expanded, that
 *     sticks alongside the catalog/schedule content — the `<aside>` is a
 *     complementary landmark labelled "Resources".
 *   • Mobile/tablet (<1024px): a persistent left column doesn't fit, so the same
 *     list collapses into a native disclosure near the top of the page — a
 *     `RESOURCES` toggle button (`aria-expanded` / `aria-controls`) that reveals
 *     the grouped links. Collapsed by default to keep the planner above the fold.
 *
 * The link list is rendered once from `src/data/resources.ts` (the single source
 * of truth); CSS controls which presentation is visible per viewport, so a
 * screen reader only ever encounters one copy of each link.
 */

function ExternalResourceLink({ link }: { link: ResourceLink }) {
  const label = resolveLabel(link.label);
  return (
    <li className="leading-snug">
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-baseline gap-1 rounded-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300 dark:hover:text-blue-200 dark:focus-visible:outline-blue-400"
      >
        <span>{label}</span>
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

export function ResourcesSidebar() {
  const [open, setOpen] = useState(false);
  const panelId = "resources-panel";

  return (
    <aside
      aria-label="Resources"
      data-testid="resources-sidebar"
      className="w-full rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40 lg:w-64 lg:shrink-0 lg:self-start lg:bg-transparent lg:p-0 lg:dark:bg-transparent"
    >
      {/* Desktop heading — plain, always visible at ≥1024px. */}
      <h2 className="hidden text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 lg:block">
        Resources
      </h2>
      <p className="mt-1 hidden text-xs text-slate-600 dark:text-slate-400 lg:block">
        Official College Board pages. Each opens in a new tab.
      </p>

      {/* Mobile/tablet heading — the disclosure trigger below 1024px. */}
      <h2 className="m-0 lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 rounded-sm text-xs font-semibold uppercase tracking-wider text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-slate-300 dark:focus-visible:outline-blue-400"
        >
          <span>Resources</span>
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
        </button>
      </h2>

      <div
        id={panelId}
        className={`${open ? "block" : "hidden"} mt-4 lg:mt-4 lg:block`}
      >
        <ResourceGroups />
      </div>
    </aside>
  );
}
