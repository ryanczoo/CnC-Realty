"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export interface AddressSuggestion {
  fullAddress: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
}

interface Props {
  onSelect: (s: AddressSuggestion) => void;
  placeholder?: string;
}

interface MapboxFeature {
  place_name: string;
  center: [number, number];
  context?: { id: string; text: string; short_code?: string }[];
  text: string;
  address?: string;
}

export function AddressAutocomplete({ onSelect, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 5) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        value
      )}.json?access_token=${token}&country=us&types=address&limit=5`;
      try {
        const res = await fetch(url);
        const json = await res.json();
        const features: MapboxFeature[] = json.features ?? [];
        const parsed = features.map((f) => {
          const zipContext = f.context?.find((c) => c.id.startsWith("postcode"));
          const cityContext = f.context?.find((c) => c.id.startsWith("place"));
          const regionContext = f.context?.find((c) => c.id.startsWith("region"));
          const streetPart = f.address ? `${f.address} ${f.text}` : f.text;
          return {
            fullAddress: f.place_name,
            street: streetPart,
            city: cityContext?.text ?? "",
            state: regionContext?.short_code?.replace(/^US-/, "") ?? regionContext?.text ?? "",
            zip: zipContext?.text ?? "",
            lat: f.center[1],
            lng: f.center[0],
          };
        });
        setSuggestions(parsed);
        setOpen(parsed.length > 0);
      } catch (err) {
        console.error("[AddressAutocomplete] geocoding failed:", err);
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  function handleSelect(s: AddressSuggestion) {
    setQuery(s.fullAddress);
    setOpen(false);
    onSelect(s);
  }

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder ?? "Enter Your Address"}
        className="w-full rounded-lg border border-[#1B1B1B]/15 bg-white px-6 py-5 pr-12 text-lg text-[#1B1B1B] placeholder:text-[#1B1B1B]/40 focus:outline-none focus:ring-1 focus:ring-cnc-gold"
      />
      {loading && (
        <Loader2 className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[#9E8C61]" />
      )}
      {open && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[#1B1B1B]/10 bg-white shadow-lg">
          {suggestions.map((s) => (
            <li key={s.fullAddress}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="block w-full px-6 py-4 text-left text-base text-[#1B1B1B] hover:bg-cnc-bg"
              >
                {s.fullAddress}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
