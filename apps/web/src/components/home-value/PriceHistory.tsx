export interface PriceHistoryEntry {
  mlsNumber: string;
  status: string;
  listPrice: number;
  closePrice: number | null;
  closeDate: string | null;
  listedAt: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

export function PriceHistory({ history }: { history: PriceHistoryEntry[] }) {
  if (history.length === 0) return null;

  return (
    <section className="py-10">
      <h3 className="text-xl font-medium text-[#1B1B1B]">Price History</h3>
      <div className="mt-6 divide-y divide-[#1B1B1B]/10 rounded-xl border border-[#1B1B1B]/10 bg-white">
        {history.map((h) => (
          <div key={h.mlsNumber} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-medium text-[#1B1B1B]">{h.status}</p>
              <p className="text-xs text-[#1B1B1B]/50">
                {h.closeDate ? `Sold ${formatDate(h.closeDate)}` : `Listed ${formatDate(h.listedAt)}`}
              </p>
            </div>
            <p className="text-base font-bold text-[#1B1B1B]">
              ${(h.closePrice ?? h.listPrice).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
