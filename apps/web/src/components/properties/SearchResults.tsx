"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useSearchFilters } from "@/hooks/useSearchFilters";
import { useProperties } from "@/hooks/useProperties";
import { useSavedProperties } from "@/hooks/useSavedProperties";
import { PropertyCard } from "./PropertyCard";
import { PropertyMap } from "./PropertyMap";
import { PropertyDrawer } from "./PropertyDrawer";
import { FilterBar } from "./FilterBar";
import { PropertyListing } from "@/types/property";
import { Loader2 } from "lucide-react";

interface Props {
  initialProperties: PropertyListing[];
  initialTotal: number;
}

function SearchResultsInner({ initialProperties, initialTotal }: Props) {
  const { filters, setFilter, clearFilters, hasActiveFilters } = useSearchFilters();
  const { properties, total, isLoading, isError, hasMore, loadNextPage } = useProperties(
    filters,
    { properties: initialProperties, total: initialTotal }
  );
  const { savedSet, toggle } = useSavedProperties();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedMls, setSelectedMls] = useState<string | null>(null);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoading) loadNextPage();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadNextPage]);

  // Save current URL for "back to search" on the full detail page
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "searchUrl",
        window.location.pathname + window.location.search
      );
    }
  }, [filters]);

  // Close drawer when filters change (new search context)
  useEffect(() => {
    setSelectedMls(null);
  }, [filters]);

  const handleHover = useCallback((mlsNumber: string | null) => {
    setHoveredId(mlsNumber);
  }, []);

  const handleSelect = useCallback((mlsNumber: string) => {
    setSelectedMls(mlsNumber);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedMls(null);
  }, []);

  return (
    <div className="fixed inset-x-0 bottom-0 flex flex-col bg-[#0f0f0f]" style={{ top: "64px" }}>
      <FilterBar
        filters={filters}
        setFilter={setFilter}
        clearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        total={total}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* List pane — 45% */}
        <div className="flex w-[45%] flex-col overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 p-3">
            {properties.map((p) => (
              <PropertyCard
                key={p.mlsNumber}
                property={p}
                isSaved={savedSet.has(p.mlsNumber)}
                onToggleSave={toggle}
                onHover={handleHover}
                onSelect={handleSelect}
              />
            ))}

            {isLoading && (
              <div className="col-span-2 flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-[#9E8C61]" />
              </div>
            )}

            {isError && (
              <div className="col-span-2 py-16 text-center text-sm text-red-400">
                Failed to load listings. Check your connection and try again.
              </div>
            )}

            {!isLoading && !isError && properties.length === 0 && (
              <div className="col-span-2 py-16 text-center text-sm text-white/40">
                No properties found. Try adjusting your filters.
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />
          </div>
        </div>

        {/* Map pane — remaining 55% */}
        <div className="flex-1">
          <PropertyMap properties={properties} hoveredId={hoveredId} />
        </div>
      </div>

      {/* Property detail drawer */}
      <AnimatePresence>
        {selectedMls && (
          <PropertyDrawer
            key={selectedMls}
            mlsNumber={selectedMls}
            onClose={handleCloseDrawer}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export function SearchResults(props: Props) {
  return (
    <Suspense fallback={<div className="h-screen bg-[#0f0f0f]" />}>
      <SearchResultsInner {...props} />
    </Suspense>
  );
}
