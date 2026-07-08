"use client";

import { useRouter } from "next/navigation";
import { Calculator, Tag, TrendingUp, BarChart3 } from "lucide-react";
import { AddressAutocomplete, AddressSuggestion } from "@/components/home-value/AddressAutocomplete";

const FEATURES = [
  { icon: Calculator, label: "Our Estimate", body: "Get a data-driven estimate based on real, local sales." },
  { icon: Tag, label: "Comparable Sales", body: "See what similar homes nearby have actually sold for." },
  { icon: TrendingUp, label: "Price History", body: "See past sale dates and prices for your home." },
  { icon: BarChart3, label: "Local Market Snapshot", body: "See recent sale activity in your ZIP code." },
];

export function HomeValueTeaser() {
  const router = useRouter();

  function handleSelect(s: AddressSuggestion) {
    const params = new URLSearchParams({
      address: s.street,
      zip: s.zip,
      lat: String(s.lat),
      lng: String(s.lng),
    });
    router.push(`/home-value?${params.toString()}`);
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-24 text-center">
      <h2 className="font-sans text-[1.9rem] font-light text-[#1B1B1B] xl:text-[2.2rem]">
        Sell <span className="text-cnc-gold font-medium">Smarter</span>
      </h2>
      <p className="mt-4 text-[#1B1B1B]/60">
        Sell your home smarter with more data and insight with our free home value report.
      </p>

      <div className="mx-auto mt-10 max-w-xl">
        <AddressAutocomplete onSelect={handleSelect} />
      </div>

      <div className="mx-auto mt-14 grid max-w-2xl grid-cols-1 gap-x-10 gap-y-8 text-left sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, label, body }) => (
          <div key={label} className="flex gap-4">
            <Icon className="mt-1 h-5 w-5 shrink-0 text-[#1B1B1B]/70" strokeWidth={1.5} />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#1B1B1B]">{label}</p>
              <p className="mt-1 text-sm text-[#1B1B1B]/60">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
