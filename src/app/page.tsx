import Link from "next/link";
import { CatalogGrid } from "@/components/CatalogGrid";
import { ScheduleView } from "@/components/ScheduleView";

export default function Home() {
  return (
    <>
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              AP Exam Planner
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Find your AP subjects and build your &ldquo;My Exams&rdquo; list.
            </p>
          </div>
          <nav aria-label="Primary" className="text-sm sm:pt-1">
            <Link
              href="/resources"
              className="inline-flex items-center gap-1 rounded-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300 dark:hover:text-blue-200 dark:focus-visible:outline-blue-400"
            >
              Resources <span aria-hidden="true">→</span>
            </Link>
          </nav>
        </div>
      </header>
      <main
        className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-10"
        aria-label="Exam planner"
      >
        <CatalogGrid />
        <ScheduleView />
      </main>
    </>
  );
}
