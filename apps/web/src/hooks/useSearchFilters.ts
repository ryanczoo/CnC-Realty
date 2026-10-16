"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_FILTERS, SearchFilters } from "@/types/property";
import { buildFilterQueryString } from "@/lib/search-filters";

export function useSearchFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [filters, setFiltersState] = useState<SearchFilters>(() => ({
    query: searchParams.get("query") ?? "",
    listingType: searchParams.get("listingType") ?? "FOR_SALE",
    minPrice: searchParams.get("minPrice") ?? "",
    maxPrice: searchParams.get("maxPrice") ?? "",
    minBeds: searchParams.get("minBeds") ?? "",
    minBaths: searchParams.get("minBaths") ?? "",
    propertyType: searchParams.get("propertyType") ?? "",
  }));

  // Applies one or more filters at once — every change is an explicit submit
  // (Enter / the search icon, or a filter dropdown's Apply button). Takes a
  // patch object (not a single key/value) so multiple fields — e.g. a parsed
  // "3 beds in whittier" search setting both query and minBeds — land in one
  // state update instead of two calls racing each other off the same stale
  // `filters` closure.
  const applyFilters = useCallback(
    (patch: Partial<SearchFilters>) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...patch };
        const qs = buildFilterQueryString(next);
        router.replace(`/properties${qs ? `?${qs}` : ""}`, { scroll: false });
        return next;
      });
    },
    [router]
  );

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    router.replace("/properties", { scroll: false });
  }, [router]);

  const hasActiveFilters = Object.entries(filters)
    .filter(([k]) => k !== "listingType")
    .some(([, v]) => Boolean(v));

  return { filters, applyFilters, clearFilters, hasActiveFilters };
}
