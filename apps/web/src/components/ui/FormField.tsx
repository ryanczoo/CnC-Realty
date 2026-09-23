"use client";

import { sanitizeCurrencyInput, formatCurrencyDisplay } from "@/lib/form-validation";

export function FormField({
  label, value, onChange, type = "text", placeholder = "", restrict, labelClassName = "text-[#1B1B1B]/50", formatCommas = false, inputMode, error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  restrict?: (v: string) => string;
  labelClassName?: string;
  // When true: value/onChange still carry a plain "digits[.digits]" string
  // (unchanged contract, safe for every existing consumer's parseFloat/Number
  // calls) — only the rendered <input> displays it with thousands-separator
  // commas, stripping them back out (and capping to 2 decimal digits) from
  // whatever the user typed before calling onChange. Forces a text input
  // under the hood since native type="number" inputs reject commas outright.
  formatCommas?: boolean;
  // Optional virtual-keyboard hint for a text-typed decimal field (e.g. a
  // percentage) — same purpose as the formatCommas branch's hardcoded
  // inputMode="decimal" below, exposed for non-currency decimal fields.
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  // Optional inline validation message (e.g. from lib/form-validation's
  // emailError). When set, the input gets a red border and the message
  // renders below it — callers own the validation logic, this component
  // only renders whatever string it's given.
  error?: string;
}) {
  const borderClass = error ? "border-red-400" : "border-[#1B1B1B]/10";

  if (formatCommas) {
    return (
      <div>
        <label className={`mb-1.5 block text-xs font-medium ${labelClassName}`}>{label}</label>
        <input
          type="text"
          inputMode="decimal"
          value={formatCurrencyDisplay(value)}
          onChange={(e) => onChange(sanitizeCurrencyInput(e.target.value, 12))}
          placeholder={placeholder}
          className={`w-full rounded-lg border ${borderClass} bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/25 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30`}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className={`mb-1.5 block text-xs font-medium ${labelClassName}`}>{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(restrict ? restrict(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border ${borderClass} bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/25 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
