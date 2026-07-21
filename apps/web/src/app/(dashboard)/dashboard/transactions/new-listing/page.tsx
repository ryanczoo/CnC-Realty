"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { SPRING_HOVER } from "@/lib/motion";
import { DateField } from "@/components/ui/DateField";
import { FormField as Field } from "@/components/ui/FormField";
import { stripDigits, digitsOnly } from "@/lib/form-validation";

const STEPS = ["Property Info", "Commission", "Review"] as const;

export default function NewListingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    propertyAddress: "", city: "", state: "CA", zip: "",
    mlsNumber: "", listPrice: "", listingType: "RESIDENTIAL_SALE",
    expirationDate: "", listDate: "",
    commissionPercent: "", commissionNotes: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit() {
    setSaving(true);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const { listing } = await res.json();
      router.push(`/dashboard/transactions/listing/${listing.id}`);
    }
    setSaving(false);
  }

  return (
    <div className="w-full">
      <div className="mb-16">
        <h1 className="text-4xl font-semibold text-[#1B1B1B]">New Listing</h1>
        <Link
          href="/dashboard/transactions"
          className="mt-1 inline-block text-sm text-[#1B1B1B]/40 hover:text-[#1B1B1B]"
        >
          ← Back
        </Link>
      </div>

      {/* Step bar */}
      <div className="mb-20 mx-auto flex max-w-5xl items-center">
        {STEPS.flatMap((s, i) => {
          const done = i < step;
          const active = i === step;
          const el = (
            <div key={s} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
              {active && <div className="h-3 w-3 rounded-full bg-[#1B1B1B]" />}
              {done && <div className="h-3 w-3 rounded-full bg-[#9E8C61]" />}
              <span
                className={`text-base ${active ? "font-semibold text-[#1B1B1B]" : done ? "text-[#9E8C61]" : "text-[#1B1B1B]/30"}`}
              >
                {s}
              </span>
            </div>
          );
          if (i < STEPS.length - 1)
            return [el, <div key={`ln-${i}`} className="mx-3 h-px flex-1 bg-[#1B1B1B]/10" />];
          return [el];
        })}
      </div>

      {/* Card */}
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#1B1B1B]/8 bg-white p-10">
        {step === 0 && (
          <div className="space-y-4">
            <Field label="Property Address *" value={form.propertyAddress} onChange={(v) => set("propertyAddress", v)} placeholder="123 Main St" />
            <div className="grid grid-cols-3 gap-4">
              <Field label="City *" value={form.city} onChange={(v) => set("city", v)} restrict={stripDigits} />
              <Field label="State" value={form.state} onChange={(v) => set("state", v)} />
              <Field label="ZIP *" value={form.zip} onChange={(v) => set("zip", v)} restrict={(v) => digitsOnly(v, 5)} />
            </div>
            <Field label="MLS Number" value={form.mlsNumber} onChange={(v) => set("mlsNumber", v)} placeholder="Optional" restrict={(v) => digitsOnly(v, 10)} />
            <Field label="List Price *" type="number" value={form.listPrice} onChange={(v) => set("listPrice", v)} placeholder="$" />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Listing Type *</label>
              <select
                value={form.listingType}
                onChange={(e) => set("listingType", e.target.value)}
                className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
              >
                <option value="RESIDENTIAL_SALE">Residential Sale</option>
                <option value="RESIDENTIAL_LEASE">Residential Lease</option>
                <option value="COMMERCIAL_SALE">Commercial Sale</option>
                <option value="COMMERCIAL_LEASE">Commercial Lease</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">List Date</label>
                <DateField value={form.listDate} onChange={(v) => set("listDate", v)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Expiration Date</label>
                <DateField value={form.expirationDate} onChange={(v) => set("expirationDate", v)} />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Commission %" type="number" value={form.commissionPercent} onChange={(v) => set("commissionPercent", v)} placeholder="e.g. 2.5" />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Commission Notes</label>
              <textarea
                value={form.commissionNotes}
                onChange={(e) => set("commissionNotes", e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/25 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2 rounded-xl border border-[#1B1B1B]/8 p-4 text-sm">
            <ReviewRow label="Address" value={`${form.propertyAddress}, ${form.city}, ${form.state} ${form.zip}`} />
            <ReviewRow label="List Price" value={form.listPrice ? `$${Number(form.listPrice).toLocaleString()}` : "—"} />
            <ReviewRow label="Type" value={form.listingType} />
            <ReviewRow label="Expiration" value={form.expirationDate || "—"} />
            <ReviewRow label="Commission" value={form.commissionPercent ? `${form.commissionPercent}%` : "—"} />
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-16 flex items-center justify-center gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="rounded-full border border-[#1B1B1B]/20 px-6 py-2.5 text-sm text-[#1B1B1B]/60 hover:border-[#1B1B1B]/40 hover:text-[#1B1B1B]"
          >
            ← Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <motion.button
            onClick={() => setStep((s) => s + 1)}
            whileHover={{ scale: 1.1 }}
            transition={SPRING_HOVER}
            className="inline-flex items-center rounded-full bg-[#1B1B1B] px-7 py-3.5 text-sm font-medium text-white"
          >
            Next →
          </motion.button>
        ) : (
          <motion.button
            onClick={submit}
            disabled={saving}
            whileHover={{ scale: 1.1 }}
            transition={SPRING_HOVER}
            className="inline-flex items-center rounded-full bg-[#1B1B1B] px-7 py-3.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Listing"}
          </motion.button>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-[#1B1B1B]/5 pb-2">
      <span className="text-[#1B1B1B]/50">{label}</span>
      <span className="font-medium text-[#1B1B1B]">{value}</span>
    </div>
  );
}
