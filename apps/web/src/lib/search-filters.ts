import { SearchFilters } from "@/types/property";

export function buildFilterQueryString(filters: SearchFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

const PARSED_KEYS = ["minBeds", "minBaths", "propertyType", "listingType"] as const;

// Typed text → the filters to change. Only what was typed changes; a typed
// price sets both ends so an old min can't sit above a newly typed max.
export function parsedToFilterPatch(params: URLSearchParams): Partial<SearchFilters> {
  const patch: Partial<SearchFilters> = { query: params.get("query") ?? "" };
  for (const k of PARSED_KEYS) {
    const v = params.get(k);
    if (v) patch[k] = v;
  }
  if (params.has("minPrice") || params.has("maxPrice")) {
    patch.minPrice = params.get("minPrice") ?? "";
    patch.maxPrice = params.get("maxPrice") ?? "";
  }
  return patch;
}
