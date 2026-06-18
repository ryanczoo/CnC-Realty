"use client";

import { useEffect, useState } from "react";

type PropertyCard = {
  mlsNumber: string;
  address: string;
  city: string;
  listPrice: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  photos: unknown;
};
type SavedItem = { mlsNumber: string; createdAt: string; property: PropertyCard | null };
type ViewedItem = { mlsNumber: string; viewedAt: string; property: PropertyCard | null };

function formatPrice(p: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(p);
}

function getPhoto(photos: unknown): string | null {
  if (!Array.isArray(photos) || photos.length === 0) return null;
  const first = photos[0];
  return typeof first === "string" ? first : (first as { url?: string })?.url ?? null;
}

function PropCard({ prop, sub }: { prop: PropertyCard; sub: string }) {
  const photo = getPhoto(prop.photos);
  return (
    <div className="rounded-xl border border-[#1B1B1B]/10 overflow-hidden">
      {photo ? (
        <img src={photo} alt={prop.address} className="h-32 w-full object-cover" />
      ) : (
        <div className="h-32 w-full bg-[#F2F0EF]" />
      )}
      <div className="p-3">
        <p className="text-sm font-medium text-[#1B1B1B]">{formatPrice(prop.listPrice)}</p>
        <p className="truncate text-xs text-[#1B1B1B]/60">{prop.address}, {prop.city}</p>
        <p className="text-xs text-[#1B1B1B]/40">{[prop.beds && `${prop.beds}bd`, prop.baths && `${prop.baths}ba`, prop.sqft && `${prop.sqft.toLocaleString()} sqft`].filter(Boolean).join(" · ")}</p>
        <p className="mt-1 text-xs text-[#1B1B1B]/30">{sub}</p>
      </div>
    </div>
  );
}

export function HomesTab({ leadId }: { leadId: string }) {
  const [data, setData] = useState<{ saved: SavedItem[]; viewed: ViewedItem[] } | null>(null);

  useEffect(() => {
    fetch(`/api/leads/${leadId}/homes`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ saved: [], viewed: [] }));
  }, [leadId]);

  if (!data) return <p className="text-sm text-[#1B1B1B]/40">Loading...</p>;

  if (data.saved.length === 0 && data.viewed.length === 0) {
    return <p className="text-sm text-[#1B1B1B]/40">This lead hasn&apos;t registered on the website yet or hasn&apos;t viewed any properties.</p>;
  }

  return (
    <div className="space-y-6">
      {data.saved.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Saved Properties</p>
          <div className="grid grid-cols-2 gap-3">
            {data.saved.filter((s) => s.property !== null).map((s) => (
              <PropCard key={s.mlsNumber} prop={s.property!} sub={`Saved ${new Date(s.createdAt).toLocaleDateString()}`} />
            ))}
          </div>
        </div>
      )}
      {data.viewed.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Recently Viewed</p>
          <div className="space-y-2">
            {data.viewed.filter((v) => v.property !== null).map((v) => (
              <div key={`${v.mlsNumber}-${v.viewedAt}`} className="flex items-center gap-3 rounded-lg bg-[#F2F0EF] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[#1B1B1B]">{v.property!.address}, {v.property!.city}</p>
                  <p className="text-xs text-[#1B1B1B]/40">{formatPrice(v.property!.listPrice)} · Viewed {new Date(v.viewedAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
