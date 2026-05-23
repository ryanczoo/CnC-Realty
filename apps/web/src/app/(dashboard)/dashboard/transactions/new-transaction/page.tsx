"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { SPRING_HOVER } from "@/lib/motion";

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

  const canAdvance = step !== 0 || !!form.transactionSide;

  return (
    <div className="w-full">
      {/* Header — top left */}
      <div className="mb-16">
        <h1 className="text-4xl font-semibold text-[#1B1B1B]">New Transaction</h1>
        <Link href="/dashboard/transactions" className="mt-1 inline-block text-sm text-[#1B1B1B]/40 hover:text-[#1B1B1B]">
          ← Back
        </Link>
      </div>

      {/* Step bar — centered, lines as direct flex siblings so they stretch properly */}
      <div className="mb-20 mx-auto flex max-w-4xl items-center">
        {STEPS.flatMap((s, i) => {
          const stepEl = (
            <div key={s} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
              {i === step && (
                <div className="h-3.5 w-3.5 rounded-full bg-[#1B1B1B]" />
              )}
              <span className={`text-lg ${i === step ? "font-semibold text-[#1B1B1B]" : "text-[#1B1B1B]/30"}`}>
                {s}
              </span>
            </div>
          );
          if (i < STEPS.length - 1) {
            return [stepEl, <div key={`line-${i}`} className="mx-3 h-px flex-1 bg-[#1B1B1B]/10" />];
          }
          return [stepEl];
        })}
      </div>

      {/* Content card — centered, wider, more padding */}
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#1B1B1B]/8 bg-white p-10">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-5">
            {SIDES.map((s) => (
              <button
                key={s.value}
                onClick={() => set("transactionSide", s.value)}
                className={`rounded-xl border p-7 text-left transition-colors ${
                  form.transactionSide === s.value
                    ? "border-[#9E8C61] bg-[#9E8C61]/5"
                    : "border-[#1B1B1B]/10 hover:border-[#1B1B1B]/25"
                }`}
              >
                <p className="text-base font-semibold text-[#1B1B1B]">{s.label}</p>
                <p className="mt-1.5 text-sm text-[#1B1B1B]/40">{s.desc}</p>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Property Address *" value={form.propertyAddress} onChange={(v) => set("propertyAddress", v)} />
            <div className="grid grid-cols-3 gap-4">
              <Field label="City *" value={form.city} onChange={(v) => set("city", v)} />
              <Field label="State" value={form.state} onChange={(v) => set("state", v)} />
              <Field label="ZIP *" value={form.zip} onChange={(v) => set("zip", v)} />
            </div>
            <Field label="MLS Number" value={form.mlsNumber} onChange={(v) => set("mlsNumber", v)} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="List Price" type="number" value={form.listPrice} onChange={(v) => set("listPrice", v)} />
              <Field label="Sale Price *" type="number" value={form.salePrice} onChange={(v) => set("salePrice", v)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Offer Date" type="date" value={form.offerDate} onChange={(v) => set("offerDate", v)} />
              <Field label="Acceptance Date" type="date" value={form.acceptanceDate} onChange={(v) => set("acceptanceDate", v)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Inspection Deadline" type="date" value={form.inspectionDeadline} onChange={(v) => set("inspectionDeadline", v)} />
              <Field label="Appraisal Deadline" type="date" value={form.appraisalDeadline} onChange={(v) => set("appraisalDeadline", v)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Loan Approval Deadline" type="date" value={form.loanApprovalDeadline} onChange={(v) => set("loanApprovalDeadline", v)} />
              <Field label="Close of Escrow *" type="date" value={form.closeOfEscrow} onChange={(v) => set("closeOfEscrow", v)} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Field label="GCI ($)" type="number" value={form.commissionGCI} onChange={(v) => set("commissionGCI", v)} />
            <Field label="Commission Split (%)" type="number" value={form.commissionSplit} onChange={(v) => set("commissionSplit", v)} />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Commission Notes</label>
              <textarea
                value={form.commissionNotes}
                onChange={(e) => set("commissionNotes", e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <ReviewRow label="Side" value={SIDES.find((s) => s.value === form.transactionSide)?.label ?? "—"} />
            <ReviewRow label="Address" value={`${form.propertyAddress}, ${form.city}, ${form.state} ${form.zip}`} />
            <ReviewRow label="Sale Price" value={form.salePrice ? `$${Number(form.salePrice).toLocaleString()}` : "—"} />
            <ReviewRow label="Close of Escrow" value={form.closeOfEscrow || "—"} />
            <ReviewRow label="GCI" value={form.commissionGCI ? `$${Number(form.commissionGCI).toLocaleString()}` : "—"} />
            <ReviewRow label="Split" value={form.commissionSplit ? `${form.commissionSplit}%` : "—"} />
          </div>
        )}
      </div>

      {/* Navigation — centered, 1.5in below card */}
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
            disabled={!canAdvance}
            whileHover={{ scale: 1.1 }}
            transition={SPRING_HOVER}
            className="inline-flex items-center rounded-full bg-[#1B1B1B] px-7 py-3.5 text-sm font-medium text-white disabled:opacity-40"
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
            {saving ? "Creating…" : "Create Transaction"}
          </motion.button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
      />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-[#1B1B1B]/5 pb-3">
      <span className="text-[#1B1B1B]/50">{label}</span>
      <span className="font-medium text-[#1B1B1B]">{value}</span>
    </div>
  );
}
