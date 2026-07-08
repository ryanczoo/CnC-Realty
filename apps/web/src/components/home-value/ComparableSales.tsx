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
  photos: unknown;
}

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === "string") return photos[0];
  return null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

export function ComparableSales({ comps }: { comps: CompDisplay[] }) {
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

  return (
    <section className="py-10">
      <h3 className="text-xl font-medium text-[#1B1B1B]">Comparable Sales</h3>
      <p className="mt-1 text-sm text-[#1B1B1B]/50">
        Homes similar to yours that have recently sold nearby.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {comps.map((c) => {
          const thumb = firstPhoto(c.photos);
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
    </section>
  );
}
