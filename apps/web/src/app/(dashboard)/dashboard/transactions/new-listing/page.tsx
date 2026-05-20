"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/transactions" className="text-sm text-[#1B1B1B]/50 hover:text-[#1B1B1B]">← Back</Link>
        <h1 className="text-xl font-light text-[#1B1B1B]">New Listing</h1>
      </div>

      <div className="mb-8 flex gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${i <= step ? "bg-[#1B1B1B] text-white" : "bg-[#F2F0EF] text-[#1B1B1B]/40"}`}>{i + 1}</div>
            <span className={`text-sm ${i === step ? "text-[#1B1B1B]" : "text-[#1B1B1B]/40"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="h-px w-8 bg-[#1B1B1B]/10" />}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-6 space-y-4">
        {step === 0 && (
          <>
            <Field label="Property Address *" value={form.propertyAddress} onChange={(v) => set("propertyAddress", v)} />
            <div className="grid grid-cols-3 gap-3">
              <Field label="City *" value={form.city} onChange={(v) => set("city", v)} />
              <Field label="State" value={form.state} onChange={(v) => set("state", v)} />
              <Field label="ZIP *" value={form.zip} onChange={(v) => set("zip", v)} />
            </div>
            <Field label="MLS Number" value={form.mlsNumber} onChange={(v) => set("mlsNumber", v)} />
            <Field label="List Price *" type="number" value={form.listPrice} onChange={(v) => set("listPrice", v)} />
            <div>
              <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">Listing Type *</label>
              <select value={form.listingType} onChange={(e) => set("listingType", e.target.value)} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm">
                <option value="RESIDENTIAL_SALE">Residential Sale</option>
                <option value="RESIDENTIAL_LEASE">Residential Lease</option>
                <option value="COMMERCIAL">Commercial</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="List Date" type="date" value={form.listDate} onChange={(v) => set("listDate", v)} />
              <Field label="Expiration Date" type="date" value={form.expirationDate} onChange={(v) => set("expirationDate", v)} />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Commission %" type="number" value={form.commissionPercent} onChange={(v) => set("commissionPercent", v)} />
            <div>
              <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">Commission Notes</label>
              <textarea value={form.commissionNotes} onChange={(e) => set("commissionNotes", e.target.value)} rows={3} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm" />
            </div>
          </>
        )}

        {step === 2 && (
          <div className="space-y-2 text-sm">
            <ReviewRow label="Address" value={`${form.propertyAddress}, ${form.city}, ${form.state} ${form.zip}`} />
            <ReviewRow label="List Price" value={form.listPrice ? `$${Number(form.listPrice).toLocaleString()}` : "—"} />
            <ReviewRow label="Type" value={form.listingType} />
            <ReviewRow label="Expiration" value={form.expirationDate || "—"} />
            <ReviewRow label="Commission" value={form.commissionPercent ? `${form.commissionPercent}%` : "—"} />
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        {step > 0 ? (
          <button onClick={() => setStep((s) => s - 1)} className="rounded-full border border-[#1B1B1B]/20 px-5 py-2 text-sm text-[#1B1B1B]/60">Back</button>
        ) : <div />}
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep((s) => s + 1)} className="rounded-full bg-[#1B1B1B] px-5 py-2 text-sm text-white">Next →</button>
        ) : (
          <button onClick={submit} disabled={saving} className="rounded-full bg-[#9E8C61] px-5 py-2 text-sm text-white disabled:opacity-50">
            {saving ? "Creating…" : "Create Listing"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30" />
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
