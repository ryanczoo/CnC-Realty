"use client";

import { useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { SearchFilters } from "@/types/property";

interface Props {
  filters: SearchFilters;
  setFilter: (key: keyof SearchFilters, value: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  total: number;
}

const PRICE_PRESETS = [
  { label: "Any", min: "", max: "" },
  { label: "Under $500K", min: "", max: "500000" },
  { label: "$500K–$1M", min: "500000", max: "1000000" },
  { label: "$1M–$2M", min: "1000000", max: "2000000" },
  { label: "$2M+", min: "2000000", max: "" },
];

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
  { label: "Single Family", value: "Residential" },
  { label: "Condo", value: "Condominium" },
  { label: "Townhouse", value: "Townhouse" },
  { label: "Multi-Family", value: "Multi-Family" },
  { label: "Land", value: "Land" },
];

type DropdownKey = "price" | "beds" | "baths" | "type" | null;

export function FilterBar({
  filters,
  setFilter,
  clearFilters,
  hasActiveFilters,
  total,
}: Props) {
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
  const barRef = useRef<HTMLDivElement>(null);

  function toggle(key: DropdownKey) {
    setOpenDropdown((prev) => (prev === key ? null : key));
  }

  const priceActive = !!(filters.minPrice || filters.maxPrice);
  const bedsActive = !!filters.minBeds;
  const bathsActive = !!filters.minBaths;
  const typeActive = !!filters.propertyType;

  const priceLabel = priceActive
    ? (PRICE_PRESETS.find(
        (p) => p.min === filters.minPrice && p.max === filters.maxPrice
      )?.label ?? "Price")
    : "Price";

  const pillBase =
    "rounded-full border px-4 py-1.5 text-sm transition-colors";
  const pillActive =
    "border-[#9E8C61] bg-[#9E8C61]/10 text-[#9E8C61]";
  const pillInactive =
    "border-white/10 text-white/60 hover:border-white/30 hover:text-white";

  return (
    <div
      ref={barRef}
      className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-[#0f0f0f]/95 px-4 py-2.5 backdrop-blur-md"
    >
      {/* Search input */}
      <div className="relative w-56">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="City, zip…"
          value={filters.query}
          onChange={(e) => setFilter("query", e.target.value)}
          className="w-full rounded-full bg-[#1a1a1a] py-1.5 pl-9 pr-4 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-[#9E8C61]/50"
        />
      </div>

      {/* Price pill */}
      <div className="relative">
        <button
          onClick={() => toggle("price")}
          className={`${pillBase} ${priceActive ? pillActive : pillInactive}`}
        >
          {priceLabel} ▾
        </button>
        {openDropdown === "price" && (
          <div className="absolute left-0 top-full z-40 mt-1 w-44 rounded-xl border border-white/10 bg-[#1a1a1a] py-1 shadow-2xl">
            {PRICE_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setFilter("minPrice", p.min);
                  setFilter("maxPrice", p.max);
                  setOpenDropdown(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white"
              >
                {p.label}
              </button>
            ))}
          </div>
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
          <div className="absolute left-0 top-full z-40 mt-1 w-32 rounded-xl border border-white/10 bg-[#1a1a1a] py-1 shadow-2xl">
            {BED_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  setFilter("minBeds", o.value);
                  setOpenDropdown(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white"
              >
                {o.label}
              </button>
            ))}
          </div>
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
          <div className="absolute left-0 top-full z-40 mt-1 w-32 rounded-xl border border-white/10 bg-[#1a1a1a] py-1 shadow-2xl">
            {BATH_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  setFilter("minBaths", o.value);
                  setOpenDropdown(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white"
              >
                {o.label}
              </button>
            ))}
          </div>
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
          <div className="absolute left-0 top-full z-40 mt-1 w-44 rounded-xl border border-white/10 bg-[#1a1a1a] py-1 shadow-2xl">
            {TYPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  setFilter("propertyType", o.value);
                  setOpenDropdown(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white"
              >
                {o.label}
              </button>
            ))}
          </div>
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
