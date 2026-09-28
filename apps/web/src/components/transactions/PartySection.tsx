"use client";
import { Plus } from "lucide-react";
import { TrashIcon } from "@/components/ui/TrashIcon";
import { FormField as Field } from "@/components/ui/FormField";
import { stripDigits, formatPhoneInput, emailError } from "@/lib/form-validation";

// Shared by the New Transaction and New Listing wizards.
export type Party = { name: string; email: string; phone: string; company: string; licenseNumber: string };
export const emptyParty = (): Party => ({ name: "", email: "", phone: "", company: "", licenseNumber: "" });

export function PartySection({
  label, parties, onUpdate, required = false,
}: {
  label: string; parties: Party[]; onUpdate: (p: Party[]) => void; required?: boolean;
}) {
  function update(i: number, field: keyof Party, value: string) {
    onUpdate(parties.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }
  const singular = label.slice(0, -1);
  return (
    <div>
      <p className="mb-3 text-center text-sm font-semibold text-[#1B1B1B]/60">{label}</p>
      <div className="space-y-3">
        {parties.map((p, i) => (
          <div key={i} className="relative rounded-xl border border-[#1B1B1B]/8 p-4">
            {parties.length > 1 && (
              <button
                onClick={() => onUpdate(parties.filter((_, idx) => idx !== i))}
                className="absolute right-3 top-3 text-[#1B1B1B]/25 hover:text-red-400"
              >
                <TrashIcon size={14} />
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${singular} Name`} required={required} value={p.name} onChange={(v) => update(i, "name", v)} restrict={stripDigits} />
              <Field label="Email" type="email" value={p.email} onChange={(v) => update(i, "email", v)} error={emailError(p.email)} />
              <Field label="Phone" type="tel" value={p.phone} onChange={(v) => update(i, "phone", v)} restrict={formatPhoneInput} />
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => onUpdate([...parties, emptyParty()])}
        className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#9E8C61] hover:text-[#7a6d4a]"
      >
        <Plus size={15} /> Add {singular}
      </button>
    </div>
  );
}
