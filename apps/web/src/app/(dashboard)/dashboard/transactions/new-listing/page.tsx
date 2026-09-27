"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { SPRING_HOVER } from "@/lib/motion";
import { DateField } from "@/components/ui/DateField";
import { FormField as Field } from "@/components/ui/FormField";
import { stripDigits, digitsOnly } from "@/lib/form-validation";
import { Spinner } from "@/components/ui/Spinner";
import { canAdvanceListingStep } from "@/lib/listing-wizard";
import { PartySection, emptyParty, type Party } from "@/components/transactions/PartySection";
import { CommissionField } from "@/components/transactions/CommissionField";
import { LISTING_TYPES, listingTypeLabel, listingPriceLabel, commissionDisplay } from "@/types/transaction";
import { listingDatesError } from "@/lib/listing-dates";
import { formatDateMDY } from "@/lib/utils";

export default function NewListingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [form, setForm] = useState({
    propertyAddress: "", city: "", state: "CA", zip: "",
    mlsNumber: "", listPrice: "", listingType: "RESIDENTIAL_SALE",
    expirationDate: "", listDate: "",
    commission: "", commissionNotes: "",
  });
  const [sellers, setSellers] = useState<Party[]>([emptyParty()]);
  // Commission is entered as a % or a flat $ — one value, sent as whichever field the toggle picks.
  const [commissionMode, setCommissionMode] = useState<"pct" | "flat">("pct");

  // Lease listings represent the owner as a landlord — same relabel the
  // Transaction wizard applies to its Sellers section on lease sides.
  const isLease = form.listingType.endsWith("_LEASE");
  const STEPS = ["Property Info", isLease ? "Landlords" : "Sellers", "Commission", "Review"];
  // Only shown once both dates are picked — a blank date just keeps Next greyed out.
  const dateOrderError = form.listDate && form.expirationDate ? listingDatesError(form.listDate, form.expirationDate) : null;

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit() {
    setSaving(true);
    setSubmitError("");
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        commissionPercent: commissionMode === "pct" ? form.commission : "",
        commissionAmount: commissionMode === "flat" ? form.commission : "",
        parties: sellers.filter((s) => s.name).map((s) => ({ role: "SELLER", ...s })),
      }),
    });
    if (res.ok) {
      const { listing } = await res.json();
      router.push(`/dashboard/transactions/listing/${listing.id}`);
      return;
    }
    const { error } = await res.json().catch(() => ({ error: "" }));
    setSubmitError(error || "Something went wrong creating this listing. Please try again.");
    setSaving(false);
  }

  return (
    <div className="w-full">
      <div className="mb-16">
        <h1 className="text-4xl font-semibold text-[#1B1B1B]">New Listing</h1>
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
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Listing Type *</label>
              <select
                value={form.listingType}
                onChange={(e) => set("listingType", e.target.value)}
                className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
              >
                {LISTING_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <Field label="Property Address *" value={form.propertyAddress} onChange={(v) => set("propertyAddress", v)} placeholder="123 Main St" />
            <div className="grid grid-cols-3 gap-4">
              <Field label="City *" value={form.city} onChange={(v) => set("city", v)} restrict={stripDigits} />
              <Field label="State" value={form.state} onChange={(v) => set("state", v)} />
              <Field label="ZIP *" value={form.zip} onChange={(v) => set("zip", v)} restrict={(v) => digitsOnly(v, 5)} />
            </div>
            <Field label="MLS Number" value={form.mlsNumber} onChange={(v) => set("mlsNumber", v)} placeholder="Optional" restrict={(v) => digitsOnly(v, 10)} />
            {/* Label follows the Listing Type live, in any order: a lease listing's price
                is its asking monthly rent. */}
            <Field label={`${listingPriceLabel(form.listingType)} *`} value={form.listPrice} onChange={(v) => set("listPrice", v)} placeholder="$" formatCommas />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">List Date *</label>
                <DateField value={form.listDate} onChange={(v) => set("listDate", v)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Expiration Date *</label>
                <DateField value={form.expirationDate} onChange={(v) => set("expirationDate", v)} />
                {dateOrderError && (
                  <p className="mt-1 text-xs text-red-500">{dateOrderError}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <PartySection label={isLease ? "Landlords" : "Sellers"} parties={sellers} onUpdate={setSellers} required />
        )}

        {step === 2 && (
          <div className="space-y-4">
            <CommissionField label="Commission" value={form.commission} onChange={(v) => set("commission", v)} mode={commissionMode} onModeChange={setCommissionMode} />
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

        {step === 3 && (
          <div className="space-y-2 rounded-xl border border-[#1B1B1B]/8 p-4 text-sm">
            <ReviewRow label="Address" value={`${form.propertyAddress}, ${form.city}, ${form.state} ${form.zip}`} />
            <ReviewRow label={listingPriceLabel(form.listingType)} value={form.listPrice ? `$${Number(form.listPrice).toLocaleString()}` : "—"} />
            <ReviewRow label="Type" value={listingTypeLabel(form.listingType)} />
            <ReviewRow label="List Date" value={formatDateMDY(form.listDate)} />
            <ReviewRow label="Expiration" value={formatDateMDY(form.expirationDate)} />
            {sellers.filter((s) => s.name).map((s, i) => (
              <ReviewRow key={i} label={`${isLease ? "Landlord" : "Seller"} ${sellers.length > 1 ? i + 1 : ""}`} value={s.name} />
            ))}
            <ReviewRow label="Commission" value={commissionMode === "pct" ? commissionDisplay(Number(form.commission), null) : commissionDisplay(null, Number(form.commission))} />
          </div>
        )}
      </div>

      {submitError && <p className="mt-6 text-center text-sm text-red-500">{submitError}</p>}

      {/* Navigation */}
      <div className="mt-16 flex items-center justify-center gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#1B1B1B]/20 px-6 py-2.5 text-sm text-[#1B1B1B]/60 hover:border-[#1B1B1B]/40 hover:text-[#1B1B1B]"
          >
            <ArrowIcon style={{ rotate: "90deg" }} /> Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <motion.button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvanceListingStep(step, form, sellers)}
            whileHover={{ scale: 1.1 }}
            transition={SPRING_HOVER}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1B1B1B] px-7 py-3.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Next <ArrowIcon style={{ rotate: "-90deg" }} />
          </motion.button>
        ) : (
          <motion.button
            onClick={submit}
            disabled={saving}
            whileHover={{ scale: 1.1 }}
            transition={SPRING_HOVER}
            className="inline-flex items-center rounded-full bg-[#1B1B1B] px-7 py-3.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? <><Spinner className="mr-2 h-4 w-4" />Creating…</> : "Create Listing"}
          </motion.button>
        )}
      </div>
    </div>
  );
}

// Same icon already duplicated per-file in RentCitiesSlider, ComparableSales,
// AgentReviewsSection, and AdvantageCarousel — matching that established
// pattern rather than extracting a new shared component. Base shape points
// diagonally; a 90deg rotate makes it point left, -90deg makes it point right.
function ArrowIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg width="14" height="14" viewBox="0 0 30 30" fill="currentColor" style={style}>
      <path d="M16 20.488c0-.13.053-.253.146-.344l13-13.002c.42-.44 1.174.24.706.707l-13 13c-.302.31-.853.096-.853-.362z" />
      <path d="M.852 7.142l14 14.002c.447.447-.273 1.16-.707.707l-14-14c-.444-.445.26-1.155.707-.708z" />
    </svg>
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
