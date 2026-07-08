"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ComparableSales, CompDisplay } from "@/components/home-value/ComparableSales";
import { PriceHistory, PriceHistoryEntry } from "@/components/home-value/PriceHistory";
import { LocalMarketSnapshot, QuarterStat } from "@/components/home-value/LocalMarketSnapshot";
import { RevealEstimateForm } from "@/components/home-value/RevealEstimateForm";

interface EstimateResponse {
  subject: { beds: number | null; baths: number | null; sqft: number | null; lotSize: number | null; matched: boolean } | null;
  needsManualEntry: boolean;
  priceHistory: PriceHistoryEntry[];
  comps: CompDisplay[];
  range: { low: number; high: number; compCount: number } | null;
  marketSnapshot: QuarterStat[];
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
  const zip = searchParams.get("zip") ?? "";

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
      <main className="bg-cnc-bg px-6 py-32 text-center">
        <p className="text-[#1B1B1B]/60">No address provided. Go back to /sell and enter your address.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="bg-cnc-bg px-6 py-32 text-center">
        <p className="text-[#1B1B1B]/60">Looking up your home…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="bg-cnc-bg px-6 py-32 text-center">
        <p className="text-[#1B1B1B]/60">
          We couldn't load your home value estimate right now. Please try again in a moment.
        </p>
      </main>
    );
  }

  if (data?.needsManualEntry) {
    return (
      <main className="bg-cnc-bg px-6 py-32">
        <ManualEntryForm onSubmit={(beds, baths, sqft) => setManualOverride({ beds, baths, sqft })} />
      </main>
    );
  }

  return (
    <main className="bg-cnc-bg px-6 pb-24 pt-32">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-[#1B1B1B]/50">Estimated Home Value for</p>
        <h1 className="mt-1 text-2xl font-medium text-[#1B1B1B]">{address}</h1>

        {data?.range && (
          <section className="mt-8 rounded-xl border border-[#1B1B1B]/10 bg-white p-8 text-center">
            <p className="text-sm text-[#1B1B1B]/50">Estimated Value Range</p>
            <p className="mt-2 text-3xl font-bold text-[#1B1B1B]">
              ${data.range.low.toLocaleString()} – ${data.range.high.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-[#1B1B1B]/40">
              Based on {data.range.compCount} comparable recent sales nearby.
            </p>
          </section>
        )}

        {data && <RevealEstimateForm address={address} zip={zip} beds={data.subject?.beds ?? null} sqft={data.subject?.sqft ?? 0} />}

        {data && <ComparableSales comps={data.comps} />}
        {data && <PriceHistory history={data.priceHistory} />}
        {data && <LocalMarketSnapshot quarters={data.marketSnapshot} />}
      </div>
    </main>
  );
}
