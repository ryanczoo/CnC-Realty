import type { SearchFilters } from "@/types/property";

// Choices made inside an open filter dropdown, held until Apply (Zillow-style).
export type FilterDraft = Partial<SearchFilters>;

export function draftValue(draft: FilterDraft, filters: SearchFilters, key: keyof SearchFilters): string {
  return draft[key] ?? filters[key];
}

export function draftChanges(draft: FilterDraft, filters: SearchFilters): FilterDraft {
  const out: FilterDraft = {};
  for (const k of Object.keys(draft) as (keyof SearchFilters)[]) {
    const v = draft[k];
    if (v !== undefined && v !== filters[k]) out[k] = v;
  }
  return out;
}
