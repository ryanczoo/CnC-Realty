"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_FILTERS, SearchFilters } from "@/types/property";

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
          const params = new URLSearchParams();
          Object.entries(next).forEach(([k, v]) => {
            if (v) params.set(k, v);
          });
          const qs = params.toString();
          router.replace(`/properties${qs ? `?${qs}` : ""}`, { scroll: false });
        }, 400);

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

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return { filters, setFilter, clearFilters, hasActiveFilters };
}
