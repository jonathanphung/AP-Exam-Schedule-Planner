// Relative import (not `@/`): src/lib modules run under vitest, which has no
// path-alias config — matches the other lib modules' convention.
import { CATEGORIES, type ApSubject, type Category } from "../data/schema";

/**
 * Pure grouping helper for the category-sectioned catalog (issue #22).
 *
 * Groups subjects under their dataset `category` in the canonical
 * {@link CATEGORIES} order (STEM → Humanities → Languages → Arts → Career
 * Kickstart) and applies the same case-insensitive name filter the flat
 * desktop grid uses, so search semantics are identical in both layouts.
 * Categories with no matching subjects are omitted (no dead whitespace and
 * no dead quick-jump targets).
 */

export interface CategoryGroup {
  category: Category;
  subjects: ApSubject[];
}

/** The same match rule as the flat catalog grid: trimmed, case-insensitive. */
export function matchesSubjectQuery(subject: ApSubject, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  return normalized === "" || subject.name.toLowerCase().includes(normalized);
}

/**
 * Group `subjects` by category in canonical order, keeping only subjects
 * whose name matches `query`. Empty categories are dropped; an all-empty
 * result returns `[]` (the caller renders its "no matches" state).
 */
export function groupSubjectsByCategory(
  subjects: readonly ApSubject[],
  query = "",
): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const category of CATEGORIES) {
    const matching = subjects.filter(
      (subject) =>
        subject.category === category && matchesSubjectQuery(subject, query),
    );
    if (matching.length > 0) groups.push({ category, subjects: matching });
  }
  return groups;
}
