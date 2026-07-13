export interface QuarterStat {
  label: string;
  count: number;
  medianPrice: number | null;
}

export function computeBarHeights(quarters: { count: number }[]): number[] {
  const max = Math.max(0, ...quarters.map((q) => q.count));
  if (max === 0) return quarters.map(() => 0);
  return quarters.map((q) => Math.round((q.count / max) * 100));
}

export function LocalMarketSnapshot({ quarters }: { quarters: QuarterStat[] }) {
  const heights = computeBarHeights(quarters);
  const latestWithSales = [...quarters].reverse().find((q) => q.medianPrice != null);

  return (
    <section className="py-10">
      <h3 className="text-xl font-medium text-[#1B1B1B]">Local Market Snapshot</h3>
      <p className="mt-1 text-sm text-[#1B1B1B]/50">
        Homes sold per quarter in your ZIP code.
      </p>

      <div className="mt-8 flex h-40 items-end gap-6">
        {quarters.map((q, i) => (
          <div key={q.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-32 w-full items-end">
              <div
                className="w-full rounded-t bg-[#9E8C61]/70"
                style={{ height: `${heights[i]}%` }}
              />
            </div>
            <p className="text-xs text-[#1B1B1B]/60">{q.label}</p>
            <p className="text-xs font-medium text-[#1B1B1B]">{q.count}</p>
          </div>
        ))}
      </div>

      {latestWithSales && (
        <p className="mt-6 text-sm text-[#1B1B1B]/60">
          <span className="font-bold text-[#1B1B1B]">
            ${latestWithSales.medianPrice!.toLocaleString()}
          </span>{" "}
          median sold price in {latestWithSales.label}
        </p>
      )}
    </section>
  );
}
