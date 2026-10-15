"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { SearchFilters } from "@/types/property";
import { buildPropertySearchParams } from "@/lib/property-search";
import { parsedToFilterPatch } from "@/lib/search-filters";
import { draftChanges, draftValue, type FilterDraft } from "@/lib/filter-draft";
import { normalizePriceDraft } from "@/lib/price-steps";
import { FilterPanel, FilterOption } from "./FilterPanel";
import { PriceRangeFilter } from "./PriceRangeFilter";

interface Props {
  filters: SearchFilters;
  setFilter: (key: keyof SearchFilters, value: string) => void;
  applyFilters: (patch: Partial<SearchFilters>) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  total: number;
}

const BED_OPTIONS = [
  { label: "Any", value: "" },
  { label: "1+", value: "1" },
  { label: "2+", value: "2" },
  { label: "3+", value: "3" },
  { label: "4+", value: "4" },
];

const BATH_OPTIONS = [
  { label: "Any", value: "" },
  { label: "1+", value: "1" },
  { label: "2+", value: "2" },
  { label: "3+", value: "3" },
];

const TYPE_OPTIONS = [
  { label: "Any Type", value: "" },
  { label: "Single Family", value: "SingleFamilyResidence" },
  { label: "Condo", value: "Condominium" },
  { label: "Townhouse", value: "Townhouse" },
  { label: "Multi-Family", value: "MultiFamily" },
  { label: "Land", value: "Land" },
  { label: "Commercial", value: "Commercial" },
];

type DropdownKey = "listingType" | "price" | "beds" | "baths" | "type" | null;

export function FilterBar({
  filters,
  applyFilters,
  clearFilters,
  hasActiveFilters,
  total,
}: Props) {
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);

  // Picks inside an open dropdown wait for Apply; opening starts a fresh draft,
  // so closing any other way (outside tap, Escape, another pill) discards it.
  const [draft, setDraft] = useState<FilterDraft>({});
  const dv = (k: keyof SearchFilters) => draftValue(draft, filters, k);
  const pick = (patch: FilterDraft) => setDraft((d) => ({ ...d, ...patch }));
  function apply() {
    let next = draft;
    if ("minPrice" in draft || "maxPrice" in draft) next = { ...draft, ...normalizePriceDraft(dv("minPrice"), dv("maxPrice")) };
    const changes = draftChanges(next, filters);
    if (Object.keys(changes).length) applyFilters(changes);
    setOpenDropdown(null);
  }

  // Escape closes the open dropdown / bottom sheet without applying.
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenDropdown(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openDropdown]);
  const barRef = useRef<HTMLDivElement>(null);

  // The query text field only searches on explicit submit (Enter or the
  // search icon), not on every keystroke — so it needs its own draft state,
  // separate from filters.query, while the user is still typing.
  const [queryDraft, setQueryDraft] = useState(filters.query);
  useEffect(() => {
    setQueryDraft(filters.query);
  }, [filters.query]);

  function submitQuery() {
    // Parse natural-language phrasing ("3 beds in whittier") the same way
    // the homepage hero and Buy page search do, so this box isn't a plain
    // literal city/zip field the moment someone types more than a place name.
    applyFilters(parsedToFilterPatch(buildPropertySearchParams(queryDraft)));
  }

  function toggle(key: DropdownKey) {
    setDraft({});
    setOpenDropdown((prev) => (prev === key ? null : key));
  }

  const priceActive = !!(filters.minPrice || filters.maxPrice);
  const bedsActive = !!filters.minBeds;
  const bathsActive = !!filters.minBaths;
  const typeActive = !!filters.propertyType;

  const pillBase =
    "rounded-full border px-4 py-1.5 text-sm transition-colors";
  const pillActive =
    "border-[#9E8C61] bg-[#9E8C61]/10 text-[#9E8C61]";
  const pillInactive =
    "border-white/10 text-white/60 hover:border-white/30 hover:text-white";

  return (
    <div
      ref={barRef}
      className="relative z-10 flex flex-wrap items-center gap-2 border-b border-white/5 bg-[#0f0f0f]/95 px-4 py-2.5 backdrop-blur-md max-lg:z-30 max-lg:backdrop-blur-none max-lg:px-3"
    >
      {/* Listing type toggle */}
      <div className="relative">
        <button
          onClick={() => toggle("listingType")}
          className={`${pillBase} ${pillActive} font-medium`}
        >
          {filters.listingType === "FOR_RENT" ? "For Rent" : "For Sale"} ▾
        </button>
        {openDropdown === "listingType" && (
          <FilterPanel width="w-36" onApply={apply}>
            {[
              { label: "For Sale", value: "FOR_SALE" },
              { label: "For Rent", value: "FOR_RENT" },
            ].map((o) => (
              <FilterOption key={o.value} selected={dv("listingType") === o.value} onClick={() => pick({ listingType: o.value })}>
                {o.label}
              </FilterOption>
            ))}
          </FilterPanel>
        )}
      </div>

      {/* Search input */}
      <div className="relative w-56 max-lg:w-auto max-lg:flex-1">
        <input
          type="text"
          placeholder="City, zip…"
          value={queryDraft}
          onChange={(e) => setQueryDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitQuery();
            }
          }}
          className="w-full rounded-full bg-[#1a1a1a] py-1.5 pl-4 pr-9 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-[#9E8C61]/50"
        />
        <button
          type="button"
          onClick={submitQuery}
          aria-label="Search"
          className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-white/30 transition-colors hover:text-[#9E8C61]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
          >
            <path d="M20 20L22 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M6.75 3.27093C8.14732 2.46262 9.76964 2 11.5 2C16.7467 2 21 6.25329 21 11.5C21 16.7467 16.7467 21 11.5 21C6.25329 21 2 16.7467 2 11.5C2 9.76964 2.46262 8.14732 3.27093 6.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Phones: one swipeable row of pills (no box on desktop: display:contents) */}
      <div
        className="contents max-lg:flex max-lg:w-full max-lg:items-center max-lg:gap-2 max-lg:overflow-x-auto max-lg:[scroll-snap-type:x_mandatory] max-lg:[&>*]:shrink-0 max-lg:[&>*]:[scroll-snap-align:start] max-lg:[&_button]:whitespace-nowrap"
        style={{ scrollbarWidth: "none" }}
      >
      {/* Price pill */}
      <div className="relative">
        <button
          onClick={() => toggle("price")}
          className={`${pillBase} ${priceActive ? pillActive : pillInactive}`}
        >
          Price ▾
        </button>
        {openDropdown === "price" && (
          <FilterPanel width="w-72" onApply={apply}>
            <PriceRangeFilter
              min={dv("minPrice")}
              max={dv("maxPrice")}
              onChange={(minPrice, maxPrice) => pick({ minPrice, maxPrice })}
            />
          </FilterPanel>
        )}
      </div>

      {/* Beds pill */}
      <div className="relative">
        <button
          onClick={() => toggle("beds")}
          className={`${pillBase} ${bedsActive ? pillActive : pillInactive}`}
        >
          {bedsActive ? `${filters.minBeds}+ Beds` : "Beds"} ▾
        </button>
        {openDropdown === "beds" && (
          <FilterPanel width="w-32" onApply={apply}>
            {BED_OPTIONS.map((o) => (
              <FilterOption key={o.value} selected={dv("minBeds") === o.value} onClick={() => pick({ minBeds: o.value })}>
                {o.label}
              </FilterOption>
            ))}
          </FilterPanel>
        )}
      </div>

      {/* Baths pill */}
      <div className="relative">
        <button
          onClick={() => toggle("baths")}
          className={`${pillBase} ${bathsActive ? pillActive : pillInactive}`}
        >
          {bathsActive ? `${filters.minBaths}+ Baths` : "Baths"} ▾
        </button>
        {openDropdown === "baths" && (
          <FilterPanel width="w-32" onApply={apply}>
            {BATH_OPTIONS.map((o) => (
              <FilterOption key={o.value} selected={dv("minBaths") === o.value} onClick={() => pick({ minBaths: o.value })}>
                {o.label}
              </FilterOption>
            ))}
          </FilterPanel>
        )}
      </div>

      {/* Type pill */}
      <div className="relative">
        <button
          onClick={() => toggle("type")}
          className={`${pillBase} ${typeActive ? pillActive : pillInactive}`}
        >
          {typeActive
            ? (TYPE_OPTIONS.find((t) => t.value === filters.propertyType)?.label ?? "Type")
            : "Type"}{" "}
          ▾
        </button>
        {openDropdown === "type" && (
          <FilterPanel width="w-44" onApply={apply}>
            {TYPE_OPTIONS.map((o) => (
              <FilterOption key={o.value} selected={dv("propertyType") === o.value} onClick={() => pick({ propertyType: o.value })}>
                {o.label}
              </FilterOption>
            ))}
          </FilterPanel>
        )}
      </div>

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      )}

      {/* Result count */}
      <span className="ml-auto text-xs text-white/30">
        {total.toLocaleString()} homes
      </span>
      </div>

      {/* Backdrop to close dropdowns */}
      {openDropdown && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setOpenDropdown(null)}
        />
      )}
    </div>
  );
}
