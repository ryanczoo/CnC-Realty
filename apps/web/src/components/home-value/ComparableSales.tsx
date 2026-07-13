"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = page * pageSize;
  return items.slice(start, start + pageSize);
}

export interface CompDisplay {
  mlsNumber: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  closePrice: number;
  closeDate: string;
  photo: string | null;
}

const PAGE_SIZE = 9;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function ArrowIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 30 30" fill="currentColor">
      <path d="M16 20.488c0-.13.053-.253.146-.344l13-13.002c.42-.44 1.174.24.706.707l-13 13c-.302.31-.853.096-.853-.362z" />
      <path d="M.852 7.142l14 14.002c.447.447-.273 1.16-.707.707l-14-14c-.444-.445.26-1.155.707-.708z" />
    </svg>
  );
}

export function ComparableSales({ comps }: { comps: CompDisplay[] }) {
  const [page, setPage] = useState(0);

  if (comps.length === 0) {
    return (
      <section className="py-10">
        <h3 className="text-xl font-medium text-[#1B1B1B]">Comparable Sales</h3>
        <p className="mt-3 text-sm text-[#1B1B1B]/50">
          Not enough recent sales nearby to show comparables yet.
        </p>
      </section>
    );
  }

  const totalPages = Math.ceil(comps.length / PAGE_SIZE);
  const visible = paginate(comps, page, PAGE_SIZE);

  return (
    <section className="py-10">
      <h3 className="text-xl font-medium text-[#1B1B1B]">Comparable Sales</h3>
      <p className="mt-1 text-sm text-[#1B1B1B]/50">
        Homes similar to yours that have recently sold nearby.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => {
          const thumb = c.photo;
          return (
            <div key={c.mlsNumber} className="overflow-hidden rounded-xl border border-[#1B1B1B]/10 bg-white">
              <div className="relative aspect-[4/3] w-full bg-[#eae7e3]">
                {thumb ? (
                  <img src={thumb} alt={c.address} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-[#1B1B1B]/30">
                    No photo
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-base font-bold text-[#1B1B1B]">
                  Sold for ${c.closePrice.toLocaleString()}
                </p>
                <p className="text-xs text-[#1B1B1B]/50">on {formatDate(c.closeDate)}</p>
                <p className="mt-1 text-xs text-[#1B1B1B]/60">
                  {c.beds ?? "—"} bd | {c.baths ?? "—"} ba | {c.sqft?.toLocaleString() ?? "—"} sqft
                </p>
                <p className="mt-1 truncate text-xs text-[#1B1B1B]/50">
                  {c.address}, {c.city}, {c.state}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-6">
          <motion.button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            className="cursor-pointer rounded-full border border-[#1B1B1B]/30 p-3 text-[#1B1B1B] disabled:cursor-not-allowed disabled:opacity-30"
            style={{ rotate: "90deg" }}
            aria-label="Previous comparable sales"
          >
            <ArrowIcon />
          </motion.button>
          <p className="text-sm text-[#1B1B1B]/60">
            Page {page + 1} of {totalPages}
          </p>
          <motion.button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            className="cursor-pointer rounded-full border border-[#1B1B1B]/30 p-3 text-[#1B1B1B] disabled:cursor-not-allowed disabled:opacity-30"
            style={{ rotate: "-90deg" }}
            aria-label="Next comparable sales"
          >
            <ArrowIcon />
          </motion.button>
        </div>
      )}
    </section>
  );
}
