"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useIsMobile, MOBILE_QUERY } from "@/hooks/useIsMobile";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { useSearchFilters } from "@/hooks/useSearchFilters";
import { useProperties } from "@/hooks/useProperties";
import { useSavedProperties } from "@/hooks/useSavedProperties";
import { PropertyCard } from "./PropertyCard";
import { PropertyMap, MapPlaceholder } from "./PropertyMap";
import { PropertyDrawer } from "./PropertyDrawer";
import { FilterBar } from "./FilterBar";
import { PropertyListing } from "@/types/property";
import { Loader2 } from "lucide-react";

interface Props {
  initialProperties: PropertyListing[];
  initialTotal: number;
}

// Phones open on the list; the map code (~1.7 MB) downloads only on the first
// "Show Map" tap. phoneAtLoad is read from the browser during the very first
// client render, so desktop places the map at exactly the same moment as
// before (no wait for mount). That first render's HTML is identical either way:
// the map's own loader and the phone placeholder are the same grey div, and the
// server always renders that div. mounted/isMobile cover a narrow window later
// widened to desktop width.
export function shouldRenderMap(
  phoneAtLoad: boolean,
  isMobile: boolean,
  mapRequested: boolean,
  mounted = false,
): boolean {
  return !phoneAtLoad || mapRequested || (mounted && !isMobile);
}

function SearchResultsInner({ initialProperties, initialTotal }: Props) {
  const { filters, applyFilters, clearFilters, hasActiveFilters } = useSearchFilters();
  const { properties, total, isLoading, isError, hasMore, loadNextPage } = useProperties(
    filters,
    { properties: initialProperties, total: initialTotal }
  );
  const { savedSet, toggle } = useSavedProperties();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedMls, setSelectedMls] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [phoneAtLoad] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [showMap, setShowMap] = useState(false);
  const [mapRequested, setMapRequested] = useState(false);
  const toggleMap = useCallback(() => {
    setMapRequested(true);
    setShowMap((v) => !v);
  }, []);

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
    <div data-navbar-theme="dark" className="fixed inset-x-0 bottom-0 flex flex-col bg-[#0f0f0f]" style={{ top: "64px" }}>
      <FilterBar
        filters={filters}
        applyFilters={applyFilters}
        clearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        total={total}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* List pane — 45% */}
        <div className={`flex w-[45%] flex-col overflow-y-auto max-lg:w-full${showMap ? " max-lg:hidden" : ""}`}>
          <div className="grid grid-cols-2 gap-3 p-3 max-sm:grid-cols-1 max-lg:pb-24">
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
              <div className="col-span-2 max-sm:col-span-1 flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-[#9E8C61]" />
              </div>
            )}

            {isError && (
              <div className="col-span-2 max-sm:col-span-1 py-16 text-center text-sm text-red-400">
                Failed to load listings. Check your connection and try again.
              </div>
            )}

            {!isLoading && !isError && properties.length === 0 && (
              <div className="col-span-2 max-sm:col-span-1 py-16 text-center text-sm text-white/40">
                No properties found. Try adjusting your filters.
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />
          </div>
        </div>

        {/* Map pane — remaining 55% */}
        <div className={`flex-1${showMap ? "" : " max-lg:hidden"}`}>
          {shouldRenderMap(phoneAtLoad, isMobile, mapRequested, mounted) ? (
            <PropertyMap properties={properties} hoveredId={hoveredId} onSelect={handleSelect} />
          ) : (
            <MapPlaceholder />
          )}
        </div>
      </div>

      {/* Phones: list/map toggle */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center lg:hidden">
        <motion.button
          type="button"
          onClick={toggleMap}
          animate={isMobile ? PULSE_ANIMATE : undefined}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          className="pointer-events-auto rounded-full bg-[#1B1B1B] px-6 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-1 ring-white/10"
        >
          {showMap ? "Show List" : "Show Map"}
        </motion.button>
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
