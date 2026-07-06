import { CatalogGrid } from "@/components/CatalogGrid";
import { ScheduleView } from "@/components/ScheduleView";
import { ResourcesSidebar } from "@/components/ResourcesSidebar";

export default function Home() {
  return (
    <>
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            AP Exam Planner
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Find your AP subjects and build your &ldquo;My Exams&rdquo; list.
          </p>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:flex-row lg:items-start lg:gap-10">
        {/* Persistent left column on desktop; a collapsed disclosure near the
            top on mobile/tablet (see ResourcesSidebar). */}
        <ResourcesSidebar />
        <main
          className="flex min-w-0 flex-1 flex-col gap-12"
          aria-label="Exam planner"
        >
          <CatalogGrid />
          <ScheduleView />
        </main>
      </div>
    </>
  );
}
