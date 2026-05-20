"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STEPS = ["Transaction Type", "Property Info", "Key Dates", "Commission", "Review"] as const;

const SIDES = [
  { value: "BUYER_SIDE", label: "Buyer Side", desc: "Representing the buyer" },
  { value: "SELLER_SIDE", label: "Seller Side", desc: "Representing the seller" },
  { value: "DUAL", label: "Dual Agency", desc: "Representing both parties" },
  { value: "LEASE", label: "Lease", desc: "Rental/lease transaction" },
] as const;

export default function NewTransactionPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    transactionSide: "",
    propertyAddress: "", city: "", state: "CA", zip: "",
    mlsNumber: "", listPrice: "", salePrice: "",
    offerDate: "", acceptanceDate: "",
    inspectionDeadline: "", appraisalDeadline: "",
    loanApprovalDeadline: "", closeOfEscrow: "",
    commissionGCI: "", commissionSplit: "", commissionNotes: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit() {
    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const { transaction } = await res.json();
      router.push(`/dashboard/transactions/transaction/${transaction.id}`);
    }
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/transactions" className="text-sm text-[#1B1B1B]/50 hover:text-[#1B1B1B]">← Back</Link>
        <h1 className="text-xl font-light text-[#1B1B1B]">New Transaction</h1>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${i <= step ? "bg-[#1B1B1B] text-white" : "bg-[#F2F0EF] text-[#1B1B1B]/40"}`}>{i + 1}</div>
            <span className={`text-sm ${i === step ? "text-[#1B1B1B]" : "text-[#1B1B1B]/40"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-[#1B1B1B]/10" />}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-6 space-y-4">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {SIDES.map((s) => (
              <button
                key={s.value}
                onClick={() => set("transactionSide", s.value)}
                className={`rounded-xl border p-4 text-left transition-colors ${form.transactionSide === s.value ? "border-[#9E8C61] bg-[#9E8C61]/5" : "border-[#1B1B1B]/10 hover:border-[#1B1B1B]/30"}`}
              >
                <p className="font-medium text-sm text-[#1B1B1B]">{s.label}</p>
                <p className="text-xs text-[#1B1B1B]/50 mt-0.5">{s.desc}</p>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <>
            <Field label="Property Address *" value={form.propertyAddress} onChange={(v) => set("propertyAddress", v)} />
            <div className="grid grid-cols-3 gap-3">
              <Field label="City *" value={form.city} onChange={(v) => set("city", v)} />
              <Field label="State" value={form.state} onChange={(v) => set("state", v)} />
              <Field label="ZIP *" value={form.zip} onChange={(v) => set("zip", v)} />
            </div>
            <Field label="MLS Number" value={form.mlsNumber} onChange={(v) => set("mlsNumber", v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="List Price" type="number" value={form.listPrice} onChange={(v) => set("listPrice", v)} />
              <Field label="Sale Price *" type="number" value={form.salePrice} onChange={(v) => set("salePrice", v)} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Offer Date" type="date" value={form.offerDate} onChange={(v) => set("offerDate", v)} />
              <Field label="Acceptance Date" type="date" value={form.acceptanceDate} onChange={(v) => set("acceptanceDate", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Inspection Deadline" type="date" value={form.inspectionDeadline} onChange={(v) => set("inspectionDeadline", v)} />
              <Field label="Appraisal Deadline" type="date" value={form.appraisalDeadline} onChange={(v) => set("appraisalDeadline", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Loan Approval Deadline" type="date" value={form.loanApprovalDeadline} onChange={(v) => set("loanApprovalDeadline", v)} />
              <Field label="Close of Escrow *" type="date" value={form.closeOfEscrow} onChange={(v) => set("closeOfEscrow", v)} />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <Field label="GCI ($)" type="number" value={form.commissionGCI} onChange={(v) => set("commissionGCI", v)} />
            <Field label="Commission Split (%)" type="number" value={form.commissionSplit} onChange={(v) => set("commissionSplit", v)} />
            <div>
              <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">Commission Notes</label>
              <textarea value={form.commissionNotes} onChange={(e) => set("commissionNotes", e.target.value)} rows={3} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm" />
            </div>
          </>
        )}

        {step === 4 && (
          <div className="space-y-2 text-sm">
            <ReviewRow label="Side" value={SIDES.find((s) => s.value === form.transactionSide)?.label ?? "—"} />
            <ReviewRow label="Address" value={`${form.propertyAddress}, ${form.city}, ${form.state} ${form.zip}`} />
            <ReviewRow label="Sale Price" value={form.salePrice ? `$${Number(form.salePrice).toLocaleString()}` : "—"} />
            <ReviewRow label="Close of Escrow" value={form.closeOfEscrow || "—"} />
            <ReviewRow label="GCI" value={form.commissionGCI ? `$${Number(form.commissionGCI).toLocaleString()}` : "—"} />
            <ReviewRow label="Split" value={form.commissionSplit ? `${form.commissionSplit}%` : "—"} />
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        {step > 0 ? (
          <button onClick={() => setStep((s) => s - 1)} className="rounded-full border border-[#1B1B1B]/20 px-5 py-2 text-sm text-[#1B1B1B]/60">Back</button>
        ) : <div />}
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 0 && !form.transactionSide}
            className="rounded-full bg-[#1B1B1B] px-5 py-2 text-sm text-white disabled:opacity-40"
          >
            Next →
          </button>
        ) : (
          <button onClick={submit} disabled={saving} className="rounded-full bg-[#9E8C61] px-5 py-2 text-sm text-white disabled:opacity-50">
            {saving ? "Creating…" : "Create Transaction"}
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
