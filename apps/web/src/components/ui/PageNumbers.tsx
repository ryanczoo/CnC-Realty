"use client";

import Link from "next/link";
import { getPageNums } from "@/lib/pagination";

const CURRENT_CLS =
  "flex h-9 w-9 items-center justify-center rounded-full bg-[#1B1B1B] font-sans text-sm font-medium text-white";
const OTHER_CLS =
  "flex h-9 w-9 items-center justify-center rounded-full font-sans text-sm text-[#1B1B1B]/50 transition-colors hover:text-[#1B1B1B]";

// Numbered pagination (FIND style, no arrows). Pages either switch in place
// (onSelect) or navigate to a URL (hrefFor). Renders nothing for a single page.
export function PageNumbers({
  current,
  total,
  onSelect,
  hrefFor,
  className = "mt-10",
}: {
  current: number;
  total: number;
  onSelect?: (page: number) => void;
  hrefFor?: (page: number) => string;
  className?: string;
}) {
  if (total <= 1) return null;

  return (
    <div className={`${className} flex items-center justify-center gap-1`}>
      {getPageNums(current, total).map((p, i) => {
        if (p === "...") {
          return (
            <span
              key={`dots-${i}`}
              className="flex h-9 w-7 items-center justify-center font-sans text-sm text-[#1B1B1B]/30"
            >
              ...
            </span>
          );
        }
        const cls = p === current ? CURRENT_CLS : OTHER_CLS;
        if (hrefFor) {
          return (
            <Link
              key={p}
              href={hrefFor(p)}
              className={cls}
              aria-current={p === current ? "page" : undefined}
            >
              {p}
            </Link>
          );
        }
        return (
          <button key={p} type="button" onClick={() => onSelect?.(p)} className={cls}>
            {p}
          </button>
        );
      })}
    </div>
  );
}
