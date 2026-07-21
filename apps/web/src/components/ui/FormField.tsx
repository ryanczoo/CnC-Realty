"use client";

export function FormField({
  label, value, onChange, type = "text", placeholder = "", restrict,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  restrict?: (v: string) => string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(restrict ? restrict(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/25 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
      />
    </div>
  );
}
