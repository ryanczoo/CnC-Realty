"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { Plus, Trash2 } from "lucide-react";
import { SPRING_HOVER } from "@/lib/motion";
import { TC_FEE, calcNetToAgent } from "@/lib/commission";
import { DateField } from "@/components/ui/DateField";

const STEPS = ["File Type", "Property", "Details", "Parties", "Commission", "Review"] as const;

const SIDES = [
  { value: "BUYER_SIDE", label: "Purchase", desc: "Representing the buyer in a purchase transaction" },
  { value: "DUAL", label: "Both Purchase & Listing", desc: "Dual agency — representing buyer and seller" },
  { value: "LEASE", label: "Lease", desc: "Residential or commercial lease transaction" },
  { value: "SELLER_SIDE", label: "Referral / Other", desc: "Referral transaction or other representation type" },
] as const;

const STAGES = [
  { value: "UNDER_CONTRACT", label: "Under Contract", desc: "You have a signed purchase agreement" },
  { value: "PRE_CONTRACT", label: "Pre-Contract", desc: "No signed contract yet — set up file early" },
] as const;

const PROPERTY_TYPES = ["Single Family", "Condo", "Townhouse", "Multi-Family", "Commercial", "Land", "Other"];

type Party = { name: string; email: string; phone: string; company: string; licenseNumber: string };
const emptyParty = (): Party => ({ name: "", email: "", phone: "", company: "", licenseNumber: "" });

type TitleEscrowParty = Party & { contactType: "Title" | "Escrow" | "Attorney" };

export default function NewTransactionPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [commissionMode, setCommissionMode] = useState<{ sale: "pct" | "flat"; listing: "pct" | "flat" }>({
    sale: "pct",
    listing: "pct",
  });

  const [tcFeeEnabled, setTcFeeEnabled] = useState(false);

  const [form, setForm] = useState({
    transactionSide: "",
    stage: "UNDER_CONTRACT",
    propertyAddress: "", city: "", state: "CA", zip: "",
    propertyType: "", mlsNumber: "", yearBuilt: "",
    listPrice: "", salePrice: "",
    acceptanceDate: "", closeOfEscrow: "",
    escrowNumber: "",
    inspectionDeadline: "", appraisalDeadline: "", loanApprovalDeadline: "",
    saleCommission: "", listingCommission: "",
    otherDeductions: "", commissionNotes: "",
  });

  const [buyers, setBuyers] = useState<Party[]>([emptyParty()]);
  const [sellers, setSellers] = useState<Party[]>([emptyParty()]);
  const [listingAgent, setListingAgent] = useState<Party>(emptyParty());
  const [titleEscrow, setTitleEscrow] = useState<TitleEscrowParty>({ ...emptyParty(), contactType: "Escrow" });
  const [loanOfficer, setLoanOfficer] = useState<Party>(emptyParty());
  const [tc, setTc] = useState<Party>(emptyParty());
  const [showLoanOfficer, setShowLoanOfficer] = useState(false);
  const [showTc, setShowTc] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const salePrice = parseFloat(form.salePrice) || 0;
  const saleCommissionAmt =
    commissionMode.sale === "pct"
      ? (salePrice * (parseFloat(form.saleCommission) || 0)) / 100
      : parseFloat(form.saleCommission) || 0;
  const listingCommissionAmt =
    commissionMode.listing === "pct"
      ? (salePrice * (parseFloat(form.listingCommission) || 0)) / 100
      : parseFloat(form.listingCommission) || 0;
  const otherDeductionsAmt = parseFloat(form.otherDeductions) || 0;
  const totalGci = saleCommissionAmt + listingCommissionAmt;
  const netToAgent = calcNetToAgent(totalGci, otherDeductionsAmt, tcFeeEnabled);

  const canAdvance = useMemo(() => {
    if (step === 0) return !!form.transactionSide;
    if (step === 1) return !!form.propertyAddress && !!form.city && !!form.zip;
    if (step === 2) return !!form.salePrice;
    return true;
  }, [step, form.transactionSide, form.propertyAddress, form.city, form.zip, form.salePrice]);

  async function submit() {
    setSaving(true);
    const parties = [
      ...buyers.filter((b) => b.name).map((b) => ({ role: "BUYER", ...b })),
      ...sellers.filter((s) => s.name).map((s) => ({ role: "SELLER", ...s })),
      ...(listingAgent.name ? [{ role: "LISTING_AGENT", ...listingAgent }] : []),
      ...(titleEscrow.name
        ? [{ role: "TITLE_ESCROW", ...titleEscrow, company: titleEscrow.contactType }]
        : []),
      ...(showLoanOfficer && loanOfficer.name ? [{ role: "LENDER", ...loanOfficer }] : []),
      ...(showTc && tc.name ? [{ role: "TRANSACTION_COORDINATOR", ...tc }] : []),
    ];
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        tcFeeEnabled,
        commissionGCI: totalGci || null,
        saleCommissionPct: commissionMode.sale === "pct" ? parseFloat(form.saleCommission) || null : null,
        listingCommissionPct: commissionMode.listing === "pct" ? parseFloat(form.listingCommission) || null : null,
        otherDeductions: otherDeductionsAmt || null,
        parties,
      }),
    });
    if (res.ok) {
      const { transaction } = await res.json();
      router.push(`/dashboard/transactions/transaction/${transaction.id}`);
    }
    setSaving(false);
  }

  const sideLabel = SIDES.find((s) => s.value === form.transactionSide)?.label ?? "—";
  const stageLabel = STAGES.find((s) => s.value === form.stage)?.label ?? "—";

  return (
    <div className="w-full">
      <div className="mb-16">
        <h1 className="text-4xl font-semibold text-[#1B1B1B]">New Transaction</h1>
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
        {/* ── Step 0: File Type ── */}
        {step === 0 && (
          <div className="space-y-8">
            <div>
              <SectionLabel>Representation Type</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                {SIDES.map((s) => (
                  <OptionCard
                    key={s.value}
                    selected={form.transactionSide === s.value}
                    onClick={() => set("transactionSide", s.value)}
                    label={s.label}
                    desc={s.desc}
                  />
                ))}
              </div>
            </div>
            {form.transactionSide && (
              <div>
                <SectionLabel>Transaction Stage</SectionLabel>
                <div className="grid grid-cols-2 gap-4">
                  {STAGES.map((s) => (
                    <OptionCard
                      key={s.value}
                      selected={form.stage === s.value}
                      onClick={() => set("stage", s.value)}
                      label={s.label}
                      desc={s.desc}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Property ── */}
        {step === 1 && (
          <div className="space-y-4">
            <Field label="Property Address *" value={form.propertyAddress} onChange={(v) => set("propertyAddress", v)} placeholder="123 Main St" />
            <div className="grid grid-cols-3 gap-4">
              <Field label="City *" value={form.city} onChange={(v) => set("city", v)} />
              <Field label="State" value={form.state} onChange={(v) => set("state", v)} />
              <Field label="ZIP *" value={form.zip} onChange={(v) => set("zip", v)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Property Type</label>
              <select
                value={form.propertyType}
                onChange={(e) => set("propertyType", e.target.value)}
                className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
              >
                <option value="">Select type…</option>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="MLS Number" value={form.mlsNumber} onChange={(v) => set("mlsNumber", v)} placeholder="Optional" />
              <Field label="Year Built" type="number" value={form.yearBuilt} onChange={(v) => set("yearBuilt", v)} placeholder="e.g. 2005" />
            </div>
          </div>
        )}

        {/* ── Step 2: Transaction Details ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="List Price" type="number" value={form.listPrice} onChange={(v) => set("listPrice", v)} placeholder="$" />
              <Field label="Sale / Purchase Price *" type="number" value={form.salePrice} onChange={(v) => set("salePrice", v)} placeholder="$" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <DateFieldRow label="Acceptance Date" value={form.acceptanceDate} onChange={(v) => set("acceptanceDate", v)} />
              <DateFieldRow label="Close of Escrow" value={form.closeOfEscrow} onChange={(v) => set("closeOfEscrow", v)} />
            </div>
            <Field label="Escrow Number" value={form.escrowNumber} onChange={(v) => set("escrowNumber", v)} placeholder="Optional" />
            <div className="border-t border-[#1B1B1B]/5 pt-5">
              <SectionLabel>Key Deadlines</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <DateFieldRow label="Inspection Deadline" value={form.inspectionDeadline} onChange={(v) => set("inspectionDeadline", v)} />
                <DateFieldRow label="Appraisal Deadline" value={form.appraisalDeadline} onChange={(v) => set("appraisalDeadline", v)} />
              </div>
              <div className="mt-4">
                <DateFieldRow label="Loan Approval Deadline" value={form.loanApprovalDeadline} onChange={(v) => set("loanApprovalDeadline", v)} />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Parties ── */}
        {step === 3 && (
          <div className="space-y-8">
            <PartySection label="Buyers" parties={buyers} onUpdate={setBuyers} />
            <PartySection label="Sellers" parties={sellers} onUpdate={setSellers} />

            {/* Listing Agent */}
            <div>
              <p className="mb-3 text-sm font-semibold text-[#1B1B1B]/60">Listing Agent</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" value={listingAgent.name} onChange={(v) => setListingAgent((a) => ({ ...a, name: v }))} />
                <Field label="Email" type="email" value={listingAgent.email} onChange={(v) => setListingAgent((a) => ({ ...a, email: v }))} />
                <Field label="Phone" type="tel" value={listingAgent.phone} onChange={(v) => setListingAgent((a) => ({ ...a, phone: v }))} />
                <Field label="License #" value={listingAgent.licenseNumber} onChange={(v) => setListingAgent((a) => ({ ...a, licenseNumber: v }))} />
                <div className="col-span-2">
                  <Field label="Brokerage" value={listingAgent.company} onChange={(v) => setListingAgent((a) => ({ ...a, company: v }))} />
                </div>
              </div>
            </div>

            {/* Title / Escrow / Attorney */}
            <div>
              <p className="mb-3 text-sm font-semibold text-[#1B1B1B]/60">Title / Escrow / Attorney</p>
              <div className="mb-4 flex gap-2">
                {(["Title", "Escrow", "Attorney"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setTitleEscrow((a) => ({ ...a, contactType: type }))}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${titleEscrow.contactType === type ? "bg-[#1B1B1B] text-white" : "bg-[#F2F0EF] text-[#1B1B1B]/60 hover:text-[#1B1B1B]"}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" value={titleEscrow.name} onChange={(v) => setTitleEscrow((a) => ({ ...a, name: v }))} />
                <Field label="Email" type="email" value={titleEscrow.email} onChange={(v) => setTitleEscrow((a) => ({ ...a, email: v }))} />
                <Field label="Phone" type="tel" value={titleEscrow.phone} onChange={(v) => setTitleEscrow((a) => ({ ...a, phone: v }))} />
                <Field label="Company" value={titleEscrow.company} onChange={(v) => setTitleEscrow((a) => ({ ...a, company: v }))} />
              </div>
            </div>

            {/* Optional: Loan Officer */}
            <div>
              <button
                onClick={() => setShowLoanOfficer((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-medium text-[#9E8C61] hover:text-[#7a6d4a]"
              >
                <Plus size={15} />
                {showLoanOfficer ? "Remove" : "Add"} Loan Officer
              </button>
              {showLoanOfficer && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Name" value={loanOfficer.name} onChange={(v) => setLoanOfficer((a) => ({ ...a, name: v }))} />
                  <Field label="Email" type="email" value={loanOfficer.email} onChange={(v) => setLoanOfficer((a) => ({ ...a, email: v }))} />
                  <Field label="Phone" type="tel" value={loanOfficer.phone} onChange={(v) => setLoanOfficer((a) => ({ ...a, phone: v }))} />
                  <Field label="Company" value={loanOfficer.company} onChange={(v) => setLoanOfficer((a) => ({ ...a, company: v }))} />
                </div>
              )}
            </div>

            {/* Optional: Transaction Coordinator */}
            <div>
              <button
                onClick={() => setShowTc((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-medium text-[#9E8C61] hover:text-[#7a6d4a]"
              >
                <Plus size={15} />
                {showTc ? "Remove" : "Add"} Transaction Coordinator
              </button>
              {showTc && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Name" value={tc.name} onChange={(v) => setTc((a) => ({ ...a, name: v }))} />
                  <Field label="Email" type="email" value={tc.email} onChange={(v) => setTc((a) => ({ ...a, email: v }))} />
                  <Field label="Phone" type="tel" value={tc.phone} onChange={(v) => setTc((a) => ({ ...a, phone: v }))} />
                  <Field label="Company" value={tc.company} onChange={(v) => setTc((a) => ({ ...a, company: v }))} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 4: Commission ── */}
        {step === 4 && (
          <div className="space-y-5">
            <CommissionField
              label="Sale Commission"
              value={form.saleCommission}
              onChange={(v) => set("saleCommission", v)}
              mode={commissionMode.sale}
              onModeChange={(m) => setCommissionMode((prev) => ({ ...prev, sale: m }))}
            />
            <CommissionField
              label="Listing Commission"
              value={form.listingCommission}
              onChange={(v) => set("listingCommission", v)}
              mode={commissionMode.listing}
              onModeChange={(m) => setCommissionMode((prev) => ({ ...prev, listing: m }))}
            />
            <Field
              label="Other Deductions ($)"
              type="number"
              value={form.otherDeductions}
              onChange={(v) => set("otherDeductions", v)}
              placeholder="TC fees, referral, other deductions…"
            />
            {/* TC Fee toggle */}
            <div className="flex items-center justify-between rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[#1B1B1B]">CnC TC Service</p>
                <p className="text-xs text-[#1B1B1B]/40">In-house transaction coordinator — ${TC_FEE}</p>
              </div>
              <button
                type="button"
                onClick={() => setTcFeeEnabled((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${tcFeeEnabled ? "bg-[#9E8C61]" : "bg-[#1B1B1B]/20"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    tcFeeEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Commission Notes</label>
              <textarea
                value={form.commissionNotes}
                onChange={(e) => set("commissionNotes", e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
              />
            </div>
            {/* Auto-calculated breakdown */}
            {salePrice > 0 && (
              <div className="rounded-xl border border-[#1B1B1B]/8 bg-[#F2F0EF] p-5 space-y-2 text-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#1B1B1B]/40">
                  Commission Breakdown
                </p>
                <BdRow label="Purchase Price" value={`$${salePrice.toLocaleString()}`} />
                <BdRow
                  label="Sale Commission"
                  value={saleCommissionAmt > 0 ? `$${Math.round(saleCommissionAmt).toLocaleString()}` : "—"}
                />
                <BdRow
                  label="Listing Commission"
                  value={listingCommissionAmt > 0 ? `$${Math.round(listingCommissionAmt).toLocaleString()}` : "—"}
                />
                {otherDeductionsAmt > 0 && (
                  <BdRow label="Other Deductions" value={`−$${otherDeductionsAmt.toLocaleString()}`} muted />
                )}
                {tcFeeEnabled && (
                  <BdRow label="CnC TC Service" value={`−$${TC_FEE}`} muted />
                )}
                <div className="border-t border-[#1B1B1B]/10 pt-2">
                  <div className="flex justify-between font-semibold text-[#1B1B1B]">
                    <span>Net to Agent</span>
                    <span>{netToAgent > 0 ? `$${Math.round(netToAgent).toLocaleString()}` : "—"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Review ── */}
        {step === 5 && (
          <div className="space-y-6 text-sm">
            <ReviewSection title="File Type">
              <ReviewRow label="Representation" value={sideLabel} />
              <ReviewRow label="Stage" value={stageLabel} />
            </ReviewSection>
            <ReviewSection title="Property">
              <ReviewRow label="Address" value={`${form.propertyAddress}, ${form.city}, ${form.state} ${form.zip}`} />
              {form.propertyType && <ReviewRow label="Type" value={form.propertyType} />}
              {form.mlsNumber && <ReviewRow label="MLS #" value={form.mlsNumber} />}
              {form.yearBuilt && <ReviewRow label="Year Built" value={form.yearBuilt} />}
            </ReviewSection>
            <ReviewSection title="Transaction Details">
              {form.salePrice && <ReviewRow label="Sale Price" value={`$${Number(form.salePrice).toLocaleString()}`} />}
              {form.closeOfEscrow && <ReviewRow label="Close of Escrow" value={form.closeOfEscrow} />}
              {form.acceptanceDate && <ReviewRow label="Acceptance Date" value={form.acceptanceDate} />}
              {form.escrowNumber && <ReviewRow label="Escrow #" value={form.escrowNumber} />}
            </ReviewSection>
            <ReviewSection title="Parties">
              {buyers.filter((b) => b.name).map((b, i) => (
                <ReviewRow key={i} label={`Buyer ${buyers.length > 1 ? i + 1 : ""}`} value={b.name} />
              ))}
              {sellers.filter((s) => s.name).map((s, i) => (
                <ReviewRow key={i} label={`Seller ${sellers.length > 1 ? i + 1 : ""}`} value={s.name} />
              ))}
              {listingAgent.name && <ReviewRow label="Listing Agent" value={listingAgent.name} />}
              {titleEscrow.name && <ReviewRow label={titleEscrow.contactType} value={titleEscrow.name} />}
              {showLoanOfficer && loanOfficer.name && <ReviewRow label="Loan Officer" value={loanOfficer.name} />}
              {showTc && tc.name && <ReviewRow label="Transaction Coordinator" value={tc.name} />}
            </ReviewSection>
            <ReviewSection title="Commission">
              {totalGci > 0 && <ReviewRow label="Total GCI" value={`$${Math.round(totalGci).toLocaleString()}`} />}
              {otherDeductionsAmt > 0 && <ReviewRow label="Deductions" value={`$${otherDeductionsAmt.toLocaleString()}`} />}
              {tcFeeEnabled && <ReviewRow label="CnC TC Service" value={`$${TC_FEE}`} />}
              {netToAgent > 0 && <ReviewRow label="Net to Agent" value={`$${Math.round(netToAgent).toLocaleString()}`} />}
            </ReviewSection>
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#1B1B1B]/40">{children}</p>
  );
}

function OptionCard({
  selected, onClick, label, desc,
}: {
  selected: boolean; onClick: () => void; label: string; desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-6 text-left transition-colors ${selected ? "border-[#9E8C61] bg-[#9E8C61]/5" : "border-[#1B1B1B]/10 hover:border-[#1B1B1B]/25"}`}
    >
      <p className="font-semibold text-[#1B1B1B]">{label}</p>
      <p className="mt-1 text-xs text-[#1B1B1B]/40">{desc}</p>
    </button>
  );
}

function DateFieldRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">{label}</label>
      <DateField value={value} onChange={onChange} />
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder = "",
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/25 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
      />
    </div>
  );
}

function PartySection({
  label, parties, onUpdate,
}: {
  label: string; parties: Party[]; onUpdate: (p: Party[]) => void;
}) {
  function update(i: number, field: keyof Party, value: string) {
    onUpdate(parties.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }
  const singular = label.slice(0, -1);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#1B1B1B]/60">{label}</p>
        <button
          onClick={() => onUpdate([...parties, emptyParty()])}
          className="flex items-center gap-1 text-xs font-medium text-[#9E8C61] hover:text-[#7a6d4a]"
        >
          <Plus size={13} /> Add {singular}
        </button>
      </div>
      <div className="space-y-3">
        {parties.map((p, i) => (
          <div key={i} className="relative rounded-xl border border-[#1B1B1B]/8 p-4">
            {parties.length > 1 && (
              <button
                onClick={() => onUpdate(parties.filter((_, idx) => idx !== i))}
                className="absolute right-3 top-3 text-[#1B1B1B]/25 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${singular} Name *`} value={p.name} onChange={(v) => update(i, "name", v)} />
              <Field label="Email" type="email" value={p.email} onChange={(v) => update(i, "email", v)} />
              <Field label="Phone" type="tel" value={p.phone} onChange={(v) => update(i, "phone", v)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommissionField({
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
              onClick={() => onModeChange(m)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${mode === m ? "bg-[#1B1B1B] text-white" : "bg-[#F2F0EF] text-[#1B1B1B]/50 hover:text-[#1B1B1B]"}`}
            >
              {m === "pct" ? "%" : "$"}
            </button>
          ))}
        </div>
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={mode === "pct" ? "e.g. 2.5" : "e.g. 15000"}
        className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/25 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
      />
    </div>
  );
}

function BdRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className={muted ? "text-[#1B1B1B]/40" : "text-[#1B1B1B]/60"}>{label}</span>
      <span className={muted ? "text-[#1B1B1B]/40" : "text-[#1B1B1B]"}>{value}</span>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#1B1B1B]/40">{title}</p>
      <div className="space-y-2 rounded-xl border border-[#1B1B1B]/8 p-4">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[#1B1B1B]/50">{label}</span>
      <span className="font-medium text-[#1B1B1B]">{value}</span>
    </div>
  );
}
