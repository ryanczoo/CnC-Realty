"use client";
import { formatCurrencyDisplay, sanitizeCurrencyInput } from "@/lib/form-validation";

// Commission as a percentage or a flat $ amount, with a %/$ toggle — the one
// commission input: every commission field in the New Transaction and New Listing
// wizards and every Overview commission pencil (listings and all transaction
// sides, leases included) uses it.
export function CommissionField({
  label, value, onChange, mode, onModeChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
  mode: "pct" | "flat"; onModeChange: (m: "pct" | "flat") => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-medium text-[#1B1B1B]/50">{label}</label>
        <div className="flex overflow-hidden rounded-lg border border-[#1B1B1B]/10">
          {(["pct", "flat"] as const).map((m) => (
            <button
              key={m}
              // A number typed as % means nothing as $ (and vice versa), so
              // switching clears it rather than carrying it across.
              onClick={() => { if (m !== mode) { onModeChange(m); onChange(""); } }}
              className={`px-3 py-1 text-xs font-medium transition-colors ${mode === m ? "bg-[#1B1B1B] text-white" : "bg-[#F2F0EF] text-[#1B1B1B]/50 hover:text-[#1B1B1B]"}`}
            >
              {m === "pct" ? "%" : "$"}
            </button>
          ))}
        </div>
      </div>
      {mode === "flat" ? (
        <input
          type="text"
          inputMode="decimal"
          value={formatCurrencyDisplay(value)}
          onChange={(e) => onChange(sanitizeCurrencyInput(e.target.value, 12))}
          placeholder="e.g. 15,000"
          className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/25 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
        />
      ) : (
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(sanitizeCurrencyInput(e.target.value, 3))}
          placeholder="e.g. 2.5"
          className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/25 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
        />
      )}
    </div>
  );
}
