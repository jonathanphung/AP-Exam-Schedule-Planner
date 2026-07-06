import type { Metadata } from "next";
import Link from "next/link";
import {
  RESOURCE_GROUPS,
  headingId,
  resolveLabel,
  type ResourceLink,
} from "@/data/resources";

export const metadata: Metadata = {
  title: "Resources — AP Exam Planner",
  description:
    "Curated official College Board links for AP season: exam dates, late-testing, calculator policies, exam modes, score distributions, and coordinator deadlines.",
};

/**
 * A single curated resource: a real anchor to an official College Board page,
 * opening in a new tab with a visible ↗ affordance and an assistive-tech-only
 * "(opens in a new tab)" hint. `rel="noopener noreferrer"` is required with
 * `target="_blank"` (security + privacy).
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
      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
        {link.description}
      </p>
    </li>
  );
}

export default function ResourcesPage() {
  return (
    <>
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <nav aria-label="Primary" className="mb-4 text-sm">
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300 dark:hover:text-blue-200 dark:focus-visible:outline-blue-400"
            >
              <span aria-hidden="true">←</span> AP Exam Planner
            </Link>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight">Resources</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Official College Board pages for AP season. Every link below is an
            official College Board resource and opens in a new tab.
          </p>
        </div>
      </header>
      <main
        className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10"
        aria-label="Resources"
      >
        {RESOURCE_GROUPS.map((group) => {
          const id = headingId(group.heading);
          return (
            <section key={group.heading} aria-labelledby={id}>
              <h2 id={id} className="text-lg font-semibold tracking-tight">
                {group.heading}
              </h2>
              <ul className="mt-4 flex flex-col gap-5">
                {group.links.map((link) => (
                  <ExternalResourceLink key={link.href} link={link} />
                ))}
              </ul>
            </section>
          );
        })}
      </main>
    </>
  );
}
