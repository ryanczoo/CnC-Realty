"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ComparableSales, CompDisplay } from "@/components/home-value/ComparableSales";
import { PriceHistory, PriceHistoryEntry } from "@/components/home-value/PriceHistory";
import { LocalMarketSnapshot } from "@/components/home-value/LocalMarketSnapshot";
import type { PriceBar } from "@/lib/home-value-estimate";
import { RevealEstimateForm } from "@/components/home-value/RevealEstimateForm";
import { RevealLine } from "@/components/ui/reveal-text";
import { buildStatsFields } from "@/lib/property-ui-helpers";
import { buildMapboxStaticImageUrl } from "@/lib/mapbox-static";

interface EstimateResponse {
  subject: {
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    lotSize: number | null;
    yearBuilt: number | null;
    county: string | null;
    propertyType: string | null;
    photo: string | null;
    matched: boolean;
  } | null;
  needsManualEntry: boolean;
  priceHistory: PriceHistoryEntry[];
  comps: CompDisplay[];
  range: { low: number; high: number; compCount: number } | null;
  marketSnapshot: { bars: PriceBar[]; medianPrice: number | null };
}

function ManualEntryForm({ onSubmit }: { onSubmit: (beds: number, baths: number, sqft: number) => void }) {
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqft, setSqft] = useState("");

  return (
    <div className="mx-auto max-w-md rounded-xl border border-[#1B1B1B]/10 bg-white p-8 text-center">
      <p className="text-sm text-[#1B1B1B]/60">
        We don't have this address on file yet — tell us a bit about the home to get an estimate.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(Number(beds), Number(baths), Number(sqft));
        }}
        className="mt-6 grid grid-cols-3 gap-3"
      >
        <input value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="Beds" type="number" required className="rounded-lg border border-[#1B1B1B]/15 bg-cnc-bg px-3 py-3 text-center text-[#1B1B1B]" />
        <input value={baths} onChange={(e) => setBaths(e.target.value)} placeholder="Baths" type="number" step="0.5" required className="rounded-lg border border-[#1B1B1B]/15 bg-cnc-bg px-3 py-3 text-center text-[#1B1B1B]" />
        <input value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="Sqft" type="number" required className="rounded-lg border border-[#1B1B1B]/15 bg-cnc-bg px-3 py-3 text-center text-[#1B1B1B]" />
        <button type="submit" className="col-span-3 mt-2 rounded-full bg-[#1B1B1B] py-3 text-sm font-medium text-white">
          Get My Estimate
        </button>
      </form>
    </div>
  );
}

export default function HomeValuePage() {
  const searchParams = useSearchParams();
  const address = searchParams.get("address") ?? "";
  const city = searchParams.get("city") ?? "";
  const state = searchParams.get("state") ?? "";
  const zip = searchParams.get("zip") ?? "";
  const cityStateZip = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const lat = searchParams.get("lat") ? Number(searchParams.get("lat")) : null;
  const lng = searchParams.get("lng") ? Number(searchParams.get("lng")) : null;

  const [data, setData] = useState<EstimateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualOverride, setManualOverride] = useState<{ beds: number; baths: number; sqft: number } | null>(null);

  useEffect(() => {
    if (!address || !zip) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ address, zip });
    if (manualOverride) {
      params.set("beds", String(manualOverride.beds));
      params.set("baths", String(manualOverride.baths));
      params.set("sqft", String(manualOverride.sqft));
    }
    fetch(`/api/home-value/estimate?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Unable to load home value data");
        }
        return res.json();
      })
      .then((json: EstimateResponse) => {
        setData(json);
        setError(null);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error("[home-value] fetch failed:", err);
          setError(err instanceof Error ? err.message : "Unable to load home value data");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [address, zip, manualOverride]);

  if (!address || !zip) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cnc-bg px-6 text-center">
        <p className="text-[#1B1B1B]/60">No address provided. Go back to /sell and enter your address.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cnc-bg px-6 text-center">
        <p className="text-[#1B1B1B]/60">One moment while we build your custom home report</p>
        <Loader2 className="h-6 w-6 animate-spin text-[#9E8C61]" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cnc-bg px-6 text-center">
        <p className="text-[#1B1B1B]/60">
          We couldn't load your home value estimate right now. Please try again in a moment.
        </p>
      </main>
    );
  }

  if (data?.needsManualEntry) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cnc-bg px-6">
        <ManualEntryForm onSubmit={(beds, baths, sqft) => setManualOverride({ beds, baths, sqft })} />
      </main>
    );
  }

  const housePhotoUrl =
    data?.subject?.photo ??
    buildMapboxStaticImageUrl({ lat, lng, token: process.env.NEXT_PUBLIC_MAPBOX_TOKEN });

  return (
    <main className="bg-cnc-bg px-8 pb-24 pt-32 lg:px-20">
      <h1 className="font-sans font-light leading-[1.1]">
        <RevealLine className="block text-[1.9rem] xl:text-[2.2rem]">Home-Value</RevealLine>
        <span className="block pl-[4.5rem]">
          <RevealLine className="text-[3rem] xl:text-[3.5rem] font-medium" color="#9E8C61" delay={0.15}>Report</RevealLine>
        </span>
      </h1>
      <div className="mx-auto max-w-7xl">
        <p className="mt-4 text-center text-2xl font-bold text-[#1B1B1B]">{address}</p>
        {cityStateZip && <p className="text-center text-lg font-medium text-[#1B1B1B]/70">{cityStateZip}</p>}

        {data?.range && (
          <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-stretch">
            {/* Photo of the searched home — the subject property's own MLS
                photo when available, else a Mapbox satellite still keyed
                off the geocoded lat/lng */}
            <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-2xl bg-[#E0DDD8] md:w-3/5">
              {housePhotoUrl ? (
                <img src={housePhotoUrl} alt={address} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-[#1B1B1B]/30">
                  No photo available
                </div>
              )}
            </div>

            <section className="flex flex-1 flex-col justify-center rounded-xl border border-[#1B1B1B]/10 bg-white p-8 text-center">
              <p className="text-sm text-[#1B1B1B]/50">Estimated Value Range</p>
              <p className="mt-2 text-3xl font-bold text-[#1B1B1B]">
                ${data.range.low.toLocaleString()} – ${data.range.high.toLocaleString()}
              </p>
              {data.subject && (
                <div className="mt-16 overflow-hidden rounded-xl">
                  <div className="grid grid-cols-3">
                    {buildStatsFields({
                      beds: data.subject.beds,
                      baths: data.subject.baths,
                      sqft: data.subject.sqft,
                      yearBuilt: data.subject.yearBuilt,
                      county: data.subject.county,
                      propertyType: data.subject.propertyType,
                    }).map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center gap-2.5 px-4 py-3.5 text-left">
                        <Icon className="h-4 w-4 shrink-0 text-[#9E8C61]" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#1B1B1B]" title={String(value)}>{value}</p>
                          <p className="text-[11px] text-[#1B1B1B]/60">{label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data && (
                <RevealEstimateForm address={address} zip={zip} beds={data.subject?.beds ?? null} sqft={data.subject?.sqft ?? 0} />
              )}
            </section>
          </div>
        )}

        {data && <ComparableSales comps={data.comps} />}
        {data && <PriceHistory history={data.priceHistory} />}
        {data && (
          <LocalMarketSnapshot
            bars={data.marketSnapshot.bars}
            medianPrice={data.marketSnapshot.medianPrice}
            zip={zip}
          />
        )}
      </div>
    </main>
  );
}
