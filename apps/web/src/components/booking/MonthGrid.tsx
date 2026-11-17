"use client";
import { buildMonthGrid, dayLabel, monthTitle, type MonthRef } from "@/lib/booking/month-grid";

export type DayState = "closed" | "open" | "selected";

export function dayState(ymd: string, days: Record<string, string[]>, selected: string | null): DayState {
  if (!(days[ymd]?.length > 0)) return "closed";
  return ymd === selected ? "selected" : "open";
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const DAY_CLS: Record<DayState, string> = {
  closed: "text-[#1B1B1B]/25 cursor-default",
  open: "bg-[#F2F0EF] font-semibold hover:bg-[#E6E2DF]",
  selected: "bg-[#1B1B1B] font-semibold text-white",
};

const ARROW_CLS =
  "flex h-8 w-8 items-center justify-center rounded-full text-lg text-[#1B1B1B]/70 transition-colors hover:bg-[#F2F0EF] disabled:opacity-25 disabled:hover:bg-transparent";

interface MonthGridProps {
  month: MonthRef;
  days: Record<string, string[]>;
  selected: string | null;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (ymd: string) => void;
}

// Month header with arrows, weekday letters, and day circles. Grid controls
// use a plain CSS hover (not the CTA pulse/spring).
export function MonthGrid({ month, days, selected, canPrev, canNext, onPrev, onNext, onSelect }: MonthGridProps) {
  const cells = buildMonthGrid(month.year, month.month0);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={onPrev} disabled={!canPrev} aria-label="Previous month" className={ARROW_CLS}>‹</button>
        <span className="text-base">{monthTitle(month.year, month.month0)}</span>
        <button type="button" onClick={onNext} disabled={!canNext} aria-label="Next month" className={ARROW_CLS}>›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="pb-1 text-xs text-[#1B1B1B]/40">{w}</div>
        ))}
        {cells.map((ymd, i) => {
          if (!ymd) return <div key={`pad-${i}`} className="h-10" />;
          const state = dayState(ymd, days, selected);
          const n = Number(ymd.slice(8));
          if (state === "closed") {
            return (
              <div key={ymd} className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm ${DAY_CLS.closed}`}>
                {n}
              </div>
            );
          }
          return (
            <button
              key={ymd}
              type="button"
              onClick={() => onSelect(ymd)}
              aria-label={dayLabel(ymd)}
              aria-pressed={state === "selected"}
              className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors ${DAY_CLS[state]}`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
