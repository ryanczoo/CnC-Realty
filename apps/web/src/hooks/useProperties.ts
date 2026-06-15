"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PropertyListing, SearchFilters } from "@/types/property";

interface UsePropertiesResult {
  properties: PropertyListing[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  loadNextPage: () => void;
}

export function useProperties(
  filters: SearchFilters,
  initialData?: { properties: PropertyListing[]; total: number }
): UsePropertiesResult {
  const [pages, setPages] = useState<PropertyListing[][]>(
    initialData ? [initialData.properties] : []
  );
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isError, setIsError] = useState(false);
  const [totalPages, setTotalPages] = useState(
    initialData ? Math.ceil(initialData.total / 20) : 1
  );
  const filtersKey = JSON.stringify(filters);
  const prevFiltersKey = useRef(filtersKey);
  const isFirstRender = useRef(true);

  const fetchPage = useCallback(async (f: SearchFilters, page: number, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (f.query) params.set("query", f.query);
    if (f.minPrice) params.set("minPrice", f.minPrice);
    if (f.maxPrice) params.set("maxPrice", f.maxPrice);
    if (f.minBeds) params.set("minBeds", f.minBeds);
    if (f.minBaths) params.set("minBaths", f.minBaths);
    if (f.propertyType) params.set("propertyType", f.propertyType);
    params.set("listingType", f.listingType);
    params.set("page", String(page));
    params.set("limit", "20");

    const res = await fetch(`/api/properties?${params}`, { signal });
    return res.json() as Promise<{ properties: PropertyListing[]; total: number; pages: number }>;
  }, []);

  useEffect(() => {
    if (isFirstRender.current && initialData) {
      isFirstRender.current = false;
      prevFiltersKey.current = filtersKey;
      return;
    }
    isFirstRender.current = false;

    if (prevFiltersKey.current === filtersKey) return;
    prevFiltersKey.current = filtersKey;

    setCurrentPage(1);
    setPages([]);
    setIsLoading(true);
    setIsError(false);

    const controller = new AbortController();

    fetchPage(filters, 1, controller.signal)
      .then((data) => {
        setPages([data.properties]);
        setTotal(data.total);
        setTotalPages(data.pages);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setIsError(true);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [filtersKey, filters, fetchPage, initialData]);

  const loadNextPage = useCallback(() => {
    if (isLoading || currentPage >= totalPages) return;
    const nextPage = currentPage + 1;
    const snapshotKey = prevFiltersKey.current;
    setCurrentPage(nextPage);
    setIsLoading(true);

    fetchPage(JSON.parse(snapshotKey) as SearchFilters, nextPage)
      .then((data) => {
        if (prevFiltersKey.current !== snapshotKey) return;
        setPages((prev) => [...prev, data.properties]);
        setTotal(data.total);
        setTotalPages(data.pages);
      })
      .catch(() => setIsError(true))
      .finally(() => setIsLoading(false));
  }, [isLoading, currentPage, totalPages, fetchPage]);

  return {
    properties: pages.flat(),
    total,
    isLoading,
    isError,
    hasMore: currentPage < totalPages,
    loadNextPage,
  };
}
