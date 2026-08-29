"use client";

import { useCallback, useRef, useState } from "react";
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setFilter = useCallback(
    (key: keyof SearchFilters, value: string) => {
      setFiltersState((prev) => {
        const next = { ...prev, [key]: value };

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const qs = buildFilterQueryString(next);
          router.replace(`/properties${qs ? `?${qs}` : ""}`, { scroll: false });
        }, 400);

        return next;
      });
    },
    [router]
  );

  // Applies one or more filters immediately, bypassing the debounce — used
  // for explicit-submit interactions (Enter key, search button click) where
  // the 400ms delay of setFilter would feel unresponsive, and where we don't
  // want every keystroke to trigger a search (see setFilter for that).
  // Takes a patch object (not a single key/value) so multiple fields — e.g.
  // a parsed "3 beds in whittier" search setting both query and minBeds —
  // land in one state update instead of two calls racing each other off the
  // same stale `filters` closure.
  const applyFilters = useCallback(
    (patch: Partial<SearchFilters>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setFiltersState(DEFAULT_FILTERS);
    router.replace("/properties", { scroll: false });
  }, [router]);

  const hasActiveFilters = Object.entries(filters)
    .filter(([k]) => k !== "listingType")
    .some(([, v]) => Boolean(v));

  return { filters, setFilter, applyFilters, clearFilters, hasActiveFilters };
}
