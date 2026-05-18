"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PropertyListing, SearchFilters } from "@/types/property";

interface UsePropertiesResult {
  properties: PropertyListing[];
  total: number;
  isLoading: boolean;
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
  const [totalPages, setTotalPages] = useState(
    initialData ? Math.ceil(initialData.total / 20) : 1
  );
  const filtersKey = JSON.stringify(filters);
  const prevFiltersKey = useRef(filtersKey);
  const isFirstRender = useRef(true);

  const fetchPage = useCallback(async (f: SearchFilters, page: number) => {
    const params = new URLSearchParams();
    if (f.query) {
      if (/^\d{5}$/.test(f.query)) params.set("zip", f.query);
      else params.set("city", f.query);
    }
    if (f.minPrice) params.set("minPrice", f.minPrice);
    if (f.maxPrice) params.set("maxPrice", f.maxPrice);
    if (f.minBeds) params.set("minBeds", f.minBeds);
    if (f.minBaths) params.set("minBaths", f.minBaths);
    if (f.propertyType) params.set("propertyType", f.propertyType);
    params.set("page", String(page));
    params.set("limit", "20");

    const res = await fetch(`/api/properties?${params}`);
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

    fetchPage(filters, 1)
      .then((data) => {
        setPages([data.properties]);
        setTotal(data.total);
        setTotalPages(data.pages);
      })
      .finally(() => setIsLoading(false));
  }, [filtersKey, filters, fetchPage, initialData]);

  const loadNextPage = useCallback(() => {
    if (isLoading || currentPage >= totalPages) return;
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    setIsLoading(true);

    fetchPage(
      JSON.parse(prevFiltersKey.current) as SearchFilters,
      nextPage
    )
      .then((data) => {
        setPages((prev) => [...prev, data.properties]);
        setTotal(data.total);
        setTotalPages(data.pages);
      })
      .finally(() => setIsLoading(false));
  }, [isLoading, currentPage, totalPages, fetchPage]);

  return {
    properties: pages.flat(),
    total,
    isLoading,
    hasMore: currentPage < totalPages,
    loadNextPage,
  };
}
