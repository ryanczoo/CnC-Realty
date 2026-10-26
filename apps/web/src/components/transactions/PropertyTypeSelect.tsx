import { RequiredMark } from "@/components/ui/RequiredMark";
import { FILE_PROPERTY_TYPES } from "@/types/transaction";

// The required Property Type dropdown, shared by the New Listing and New
// Transaction wizards (same 11 options as the Overview).
export function PropertyTypeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Property Type<RequiredMark /></label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
      >
        <option value="">Select type…</option>
        {FILE_PROPERTY_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  );
}
