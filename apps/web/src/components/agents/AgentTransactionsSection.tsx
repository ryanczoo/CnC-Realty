"use client";

import { useState } from "react";
import { RevealLine } from "@/components/ui/reveal-text";

export type AgentTransaction = {
  id: string;
  propertyAddress: string;
  city: string;
  state: string;
  transactionSide: "BUYER_SIDE" | "SELLER_SIDE" | "DUAL" | "LEASE";
  salePrice: number | null;
  listPrice: number | null;
  closeOfEscrow: string | null;
};

// Internal display type — used for both real and placeholder items
type DisplayItem = {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number;
  statsLine: string;
};

const SIDE_LABEL: Record<AgentTransaction["transactionSide"], string> = {
  BUYER_SIDE:  "Buyer's Agent",
  SELLER_SIDE: "Seller's Agent",
  DUAL:        "Dual Agent",
  LEASE:       "Lease",
};


function realToDisplay(tx: AgentTransaction): DisplayItem {
  const dateStr = tx.closeOfEscrow
    ? new Date(tx.closeOfEscrow).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;
  return {
    id: tx.id,
    address: tx.propertyAddress,
    city: tx.city,
    state: tx.state,
    price: tx.salePrice ?? tx.listPrice ?? 0,
    statsLine: [SIDE_LABEL[tx.transactionSide], dateStr && `Closed ${dateStr}`]
      .filter(Boolean)
      .join("  ·  "),
  };
}

const PER_PAGE = 6;

function fmtPrice(n: number) {
  return "$" + n.toLocaleString("en-US");
}

function getPageNums(cur: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "...")[] = [1];
  if (cur > 3) out.push("...");
  const lo = Math.max(2, cur - 1);
  const hi = Math.min(total - 1, cur + 1);
  for (let i = lo; i <= hi; i++) out.push(i);
  if (cur < total - 2) out.push("...");
  out.push(total);
  return out;
}

function HousePlaceholder() {
  return (
    <svg
      width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke="#B0A899" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function AgentTransactionsSection({
  transactions,
  displayName,
}: {
  transactions: AgentTransaction[];
  displayName: string;
}) {
  const firstName = (displayName ?? "Agent").split(" ")[0];
  const [page, setPage] = useState(1);

  const hasData = transactions.length > 0;
  const items: DisplayItem[] = hasData ? transactions.map(realToDisplay) : [];

  const totalPages = Math.ceil(items.length / PER_PAGE);
  const pageItems = items.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pageNums = getPageNums(page, totalPages);

  return (
    <section className="relative bg-white px-6 py-20 md:px-12 lg:px-20">
      {/* Gradient bridges — blends with adjacent bg-cnc-bg sections */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20" style={{ background: "linear-gradient(to bottom, #F2F0EF, #ffffff)" }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20" style={{ background: "linear-gradient(to bottom, #ffffff, #F2F0EF)" }} />

      <div className="mx-auto max-w-6xl">

        {/* Title — left-aligned, matches "Client Reviews" style */}
        <div className="mb-12">
          <h2 className="font-sans text-[2.5rem] font-light xl:text-[3rem]">
            <RevealLine>
              <span className="text-[1.9rem] xl:text-[2.2rem] text-[#1B1B1B]/70">{firstName}&apos;s </span>
              <span className="text-cnc-gold font-medium">Transactions</span>
            </RevealLine>
          </h2>
        </div>

        {/* Empty state */}
        {!hasData && (
          <p className="py-16 text-center font-sans text-sm text-[#1B1B1B]/35">Coming soon...</p>
        )}

        {/* Grid — 2 rows × 3 columns */}
        {hasData && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-4 rounded-xl border border-[#E0DDD8] bg-cnc-bg p-4 hover:border-[#9E8C61]/30 transition-colors"
            >
              {/* Thumbnail placeholder */}
              <div className="flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-lg bg-[#ECEAE7]">
                <HousePlaceholder />
              </div>

              {/* Details */}
              <div className="min-w-0 flex-1">
                <p className="mb-2 font-sans text-[1.05rem] font-bold leading-tight text-[#1B1B1B]">
                  {fmtPrice(tx.price)}
                </p>
                <p className="mb-2 font-sans text-[0.7rem] text-[#1B1B1B]/45">
                  {tx.statsLine}
                </p>
                <p className="truncate font-sans text-[0.7rem] text-[#1B1B1B]/45">
                  {tx.address}, {tx.city}, {tx.state}
                </p>
              </div>
            </div>
          ))}
        </div>
        )}

        {/* Pagination — FIND style, no arrows */}
        {hasData && totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-1">
            {pageNums.map((p, i) =>
              p === "..." ? (
                <span
                  key={`dots-${i}`}
                  className="flex h-9 w-7 items-center justify-center font-sans text-sm text-[#1B1B1B]/30"
                >
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={
                    p === page
                      ? "flex h-9 w-9 items-center justify-center rounded-full bg-[#1B1B1B] font-sans text-sm font-medium text-white"
                      : "flex h-9 w-9 items-center justify-center rounded-full font-sans text-sm text-[#1B1B1B]/50 transition-colors hover:text-[#1B1B1B]"
                  }
                >
                  {p}
                </button>
              )
            )}
          </div>
        )}

      </div>
    </section>
  );
}
