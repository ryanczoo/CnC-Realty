"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { TrashIcon } from "@/components/ui/TrashIcon";
import { SPRING_HOVER } from "@/lib/motion";
import { TC_FEE, calcNetToAgent, calcTransactionFee } from "@/lib/commission";
import { escrowTypeToRole, type EscrowContactType } from "@/lib/transaction-helpers";
import { DateField } from "@/components/ui/DateField";
import { FormField as Field } from "@/components/ui/FormField";
import { stripDigits, digitsOnly, formatPhoneInput, sanitizeCurrencyInput, formatCurrencyDisplay, emailError } from "@/lib/form-validation";
import { SIDES, type TransactionSide } from "@/types/transaction";
import { Spinner } from "@/components/ui/Spinner";

const STAGES = [
  { value: "UNDER_CONTRACT", label: "Under Contract", desc: "You have a signed agreement" },
  { value: "PRE_CONTRACT", label: "Pre-Contract", desc: "Setup file early" },
] as const;

const PROPERTY_CATEGORIES = [
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
] as const;

const PROPERTY_TYPES = ["Single Family", "Condo", "Townhouse", "Multi-Family", "Commercial", "Land", "Industrial", "Farm and Ranch", "Manufactured Home", "Co-Op", "Other"];
const MULTI_PARCEL_OPTIONS = Array.from({ length: 99 }, (_, i) => i + 2); // 2–100; blank/1 both mean "not multi-parcel"

type Party = { name: string; email: string; phone: string; company: string; licenseNumber: string };
const emptyParty = (): Party => ({ name: "", email: "", phone: "", company: "", licenseNumber: "" });

export default function NewTransactionPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [commissionMode, setCommissionMode] = useState<{ sale: "pct" | "flat"; listing: "pct" | "flat" }>({
    sale: "pct",
    listing: "pct",
  });

  const [tcFeeEnabled, setTcFeeEnabled] = useState(false);
  const [agentRelativeSale, setAgentRelativeSale] = useState(false);
  const [brokerProvidedLead, setBrokerProvidedLead] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoTempId] = useState(() => crypto.randomUUID());

  const [form, setForm] = useState({
    transactionSide: "",
    propertyCategory: "",
    stage: "UNDER_CONTRACT",
    propertyAddress: "", city: "", state: "CA", zip: "",
    propertyType: "", mlsNumber: "", yearBuilt: "",
    legalDescription: "", propertyIncludes: "", propertyExcludes: "",
    taxId: "", numberOfParcels: "", schoolDistrict: "", zoningClass: "", photoKey: "",
    listPrice: "", salePrice: "", leasePrice: "", deposit: "",
    offerDate: "", offerExpirationDate: "",
    acceptanceDate: "", closeOfEscrow: "",
    finalWalkthroughDate: "", possessionDate: "",
    escrowNumber: "",
    inspectionDeadline: "", appraisalDeadline: "", loanApprovalDeadline: "",
    saleCommission: "", listingCommission: "",
    otherDeductions: "", commissionNotes: "",
    referredToAgentName: "",
    referredToBrokerageName: "",
    referredToContactEmail: "",
    referredToContactPhone: "",
    dateReferred: "",
  });

  const [conditions, setConditions] = useState<{ name: string; dueDate: string; notes: string }[]>([]);

  const [buyers, setBuyers] = useState<Party[]>([emptyParty()]);
  const [sellers, setSellers] = useState<Party[]>([emptyParty()]);
  const [listingAgent, setListingAgent] = useState<Party>(emptyParty());
  // One set of fields per contact type, so switching the toggle never loses what
  // was typed for the other types. Any of the three with a name becomes its own
  // party at Create.
  const [escrowContacts, setEscrowContacts] = useState<Record<EscrowContactType, Party>>({
    Title: emptyParty(), Escrow: emptyParty(), Attorney: emptyParty(),
  });
  const [activeEscrowType, setActiveEscrowType] = useState<EscrowContactType>("Escrow");
  const [loanOfficer, setLoanOfficer] = useState<Party>(emptyParty());
  const [tc, setTc] = useState<Party>(emptyParty());
  const [referralAgent, setReferralAgent] = useState<Party>(emptyParty());
  const [showLoanOfficer, setShowLoanOfficer] = useState(false);
  const [showTc, setShowTc] = useState(false);
  const [showReferralAgent, setShowReferralAgent] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const isLeaseSide = ["LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL"].includes(form.transactionSide);
  const isReferral = form.transactionSide === "REFERRAL";

  // Lease files have no salePrice to multiply a % against (leases populate
  // leasePrice instead), so a "%" commission mode silently produces a $0 gross
  // commission. Force flat-dollar mode the moment the side becomes a lease side —
  // covers both picking a lease type directly and switching to one after Step 4
  // was already visited with "%" selected.
  useEffect(() => {
    if (isLeaseSide) {
      setCommissionMode((prev) =>
        prev.sale === "flat" && prev.listing === "flat" ? prev : { sale: "flat", listing: "flat" }
      );
    }
  }, [isLeaseSide]);

  const STEPS = isReferral
    ? ["File Type", "Referral Details", "Review"]
    : ["File Type", "Property", "Details", "Parties", "Commission", "Review"];
  // Map the raw step index onto the step-bar position. For referral, the Review
  // body reuses index 5 (per the wizard's index-reuse design) but is the 3rd bar
  // entry, so 5 -> 2. Identity for the other 6 types (isReferral === false), so
  // their step-bar highlighting is unchanged.
  const displayStep = isReferral ? (step === 5 ? 2 : step) : step;

  const salePrice = parseFloat(form.salePrice) || 0;
  const leasePrice = parseFloat(form.leasePrice) || 0;
  const saleCommissionAmt =
    commissionMode.sale === "pct"
      ? (salePrice * (parseFloat(form.saleCommission) || 0)) / 100
      : parseFloat(form.saleCommission) || 0;
  const listingCommissionAmt =
    commissionMode.listing === "pct"
      ? (salePrice * (parseFloat(form.listingCommission) || 0)) / 100
      : parseFloat(form.listingCommission) || 0;
  const otherDeductionsAmt = parseFloat(form.otherDeductions) || 0;
  // An agent only ever gets paid according to their own side's commission
  // agreement — a Purchase-side (buyer's) agent's Net to Agent is unaffected
  // by whatever the seller's agent negotiated, and vice versa on Listing side.
  // Only Dual agency sums both, since the agent has separate agreements with
  // both parties. Lease sides fall through to the sum too, but that's safe:
  // listingCommissionAmt is always 0 there (the field is hidden on lease
  // sides — see the isLeaseSide branch below), so it adds nothing.
  const totalGci =
    form.transactionSide === "PURCHASE" ? saleCommissionAmt :
    form.transactionSide === "LISTING" ? listingCommissionAmt :
    saleCommissionAmt + listingCommissionAmt;
  const transactionFee = calcTransactionFee({
    side: form.transactionSide as TransactionSide,
    salePrice,
    grossCommission: totalGci,
    agentRelativeSale,
    brokerProvidedLead,
    numberOfParcels: form.numberOfParcels ? parseInt(form.numberOfParcels, 10) : null,
  });
  const netToAgent = calcNetToAgent(totalGci, transactionFee.fee, otherDeductionsAmt, tcFeeEnabled);
  // Always shows exactly 2 decimal digits (never rounds cents away) — matches
  // the file-detail page's Commission tab, which already formats this way.
  const fmtAmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Which party section gates Next on Step 3, mirroring how the agent
  // always knows the side they represent when the file is created.
  const partiesReady = useMemo(() => {
    const hasBuyer = buyers.some((b) => b.name.trim());
    const hasSeller = sellers.some((s) => s.name.trim());
    switch (form.transactionSide) {
      case "PURCHASE":
      case "LEASE_TENANT":
        return hasBuyer;
      case "LISTING":
      case "LEASE_LANDLORD":
        return hasSeller;
      case "DUAL":
      case "LEASE_DUAL":
        return hasBuyer && hasSeller;
      default:
        return true;
    }
  }, [form.transactionSide, buyers, sellers]);

  const buyerSectionRequired = useMemo(() => {
    return ["PURCHASE", "LEASE_TENANT", "DUAL", "LEASE_DUAL"].includes(form.transactionSide);
  }, [form.transactionSide]);

  const sellerSectionRequired = useMemo(() => {
    return ["LISTING", "LEASE_LANDLORD", "DUAL", "LEASE_DUAL"].includes(form.transactionSide);
  }, [form.transactionSide]);

  // Only checks emails belonging to a party that actually has a name — an
  // unnamed row (e.g. typed into the Escrow tab, then switched to Title
  // without naming Escrow) never reaches submit() at all (see its own
  // per-type .filter((t) => escrowContacts[t].name)), so its email
  // shouldn't be able to block Next either.
  const partyEmailsValid = useMemo(() => {
    const namedPartyOk = (p: Party) => !p.name.trim() || !emailError(p.email);
    return (
      buyers.every(namedPartyOk) &&
      sellers.every(namedPartyOk) &&
      namedPartyOk(listingAgent) &&
      (["Title", "Escrow", "Attorney"] as const).every((t) => namedPartyOk(escrowContacts[t])) &&
      (!showLoanOfficer || namedPartyOk(loanOfficer)) &&
      (!showTc || namedPartyOk(tc)) &&
      (!showReferralAgent || namedPartyOk(referralAgent))
    );
  }, [buyers, sellers, listingAgent, escrowContacts, showLoanOfficer, loanOfficer, showTc, tc, showReferralAgent, referralAgent]);

  const canAdvance = useMemo(() => {
    if (step === 0) return isReferral ? !!form.transactionSide : (!!form.transactionSide && !!form.propertyCategory);
    if (step === 1) return isReferral ? (!!form.referredToAgentName && !emailError(form.referredToContactEmail)) : (!!form.propertyAddress && !!form.city && !!form.zip && !!form.propertyType && !!form.mlsNumber);
    if (step === 2) return isLeaseSide ? !!form.leasePrice : !!form.salePrice;
    if (step === 3) return partiesReady && partyEmailsValid;
    return true;
  }, [step, isReferral, form.transactionSide, form.propertyCategory, form.referredToAgentName, form.referredToContactEmail, form.propertyAddress, form.city, form.zip, form.propertyType, form.mlsNumber, form.salePrice, form.leasePrice, partiesReady, partyEmailsValid]);

  function goNext() {
    setStep((s) => {
      if (isReferral && s === 0) return 1; // File Type -> Referral Details
      if (isReferral && s === 1) return 5; // Referral Details -> Review (reuses index 5's existing Review render)
      return s + 1;
    });
  }
  function goBack() {
    setStep((s) => {
      if (isReferral && s === 5) return 1;
      if (isReferral && s === 1) return 0;
      return s - 1;
    });
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const params = new URLSearchParams({
        fileType: "transaction",
        fileId: photoTempId,
        filename: file.name,
        contentType: file.type,
        size: String(file.size),
      });
      const { uploadUrl, key } = await fetch(`/api/upload-url?${params}`).then((r) => r.json());
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      set("photoKey", key);
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  }

  async function submit() {
    setSaving(true);
    const parties = [
      ...buyers.filter((b) => b.name).map((b) => ({ role: "BUYER", ...b })),
      ...sellers.filter((s) => s.name).map((s) => ({ role: "SELLER", ...s })),
      ...(listingAgent.name ? [{ role: "LISTING_AGENT", ...listingAgent }] : []),
      ...(["Title", "Escrow", "Attorney"] as const)
        .filter((t) => escrowContacts[t].name)
        .map((t) => ({ role: escrowTypeToRole(t), ...escrowContacts[t] })),
      ...(showLoanOfficer && loanOfficer.name ? [{ role: "LENDER", ...loanOfficer }] : []),
      ...(showTc && tc.name ? [{ role: "TRANSACTION_COORDINATOR", ...tc }] : []),
      ...(showReferralAgent && referralAgent.name ? [{ role: "REFERRAL_AGENT", ...referralAgent }] : []),
    ];
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        tcFeeEnabled,
        agentRelativeSale: isLeaseSide ? false : agentRelativeSale,
        brokerProvidedLead: isLeaseSide ? false : brokerProvidedLead,
        commissionGCI: totalGci || null,
        saleCommissionPct: commissionMode.sale === "pct" ? parseFloat(form.saleCommission) || null : null,
        listingCommissionPct: commissionMode.listing === "pct" ? parseFloat(form.listingCommission) || null : null,
        otherDeductions: otherDeductionsAmt || null,
        parties,
      }),
    });
    if (res.ok) {
      const { transaction } = await res.json();
      const validConditions = conditions.filter((c) => c.name);
      if (validConditions.length > 0) {
        await Promise.all(
          validConditions.map((c) =>
            fetch(`/api/transactions/${transaction.id}/conditions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(c),
            })
          )
        );
      }
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
          const done = i < displayStep;
          const active = i === displayStep;
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
              <SectionLabel className="text-center">Transaction Type</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                {SIDES.map((s, i) => (
                  <OptionCard
                    key={s.value}
                    selected={form.transactionSide === s.value}
                    onClick={() => set("transactionSide", s.value)}
                    label={s.label}
                    desc={s.desc}
                    className={i === SIDES.length - 1 && SIDES.length % 2 === 1 ? "col-span-2 w-[calc(50%-0.5rem)] justify-self-center" : ""}
                  />
                ))}
              </div>
            </div>
            {form.transactionSide && (
              <div>
                <SectionLabel className="text-center">Transaction Stage</SectionLabel>
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
            {form.transactionSide && !isReferral && (
              <div>
                <SectionLabel className="text-center">Select One</SectionLabel>
                <div className="grid grid-cols-2 gap-4">
                  {PROPERTY_CATEGORIES.map((c) => (
                    <OptionCard
                      key={c.value}
                      selected={form.propertyCategory === c.value}
                      onClick={() => set("propertyCategory", c.value)}
                      label={c.label}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Property (or Referral Details when Referral) ── */}
        {step === 1 && (
          isReferral ? (
            <div className="space-y-5">
              <Field label="Referred-To Agent Name *" value={form.referredToAgentName} onChange={(v) => set("referredToAgentName", v)} />
              <Field label="Referred-To Brokerage Name" value={form.referredToBrokerageName} onChange={(v) => set("referredToBrokerageName", v)} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Contact Email" type="email" value={form.referredToContactEmail} onChange={(v) => set("referredToContactEmail", v)} error={emailError(form.referredToContactEmail)} />
                <Field label="Contact Phone" type="tel" value={form.referredToContactPhone} onChange={(v) => set("referredToContactPhone", v)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Date Referred</label>
                <DateField value={form.dateReferred} onChange={(v) => set("dateReferred", v)} />
              </div>
            </div>
          ) : (
          <div className="space-y-4">
            <Field label="Property Address *" value={form.propertyAddress} onChange={(v) => set("propertyAddress", v)} placeholder="123 Main St" />
            <div className="grid grid-cols-3 gap-4">
              <Field label="City *" value={form.city} onChange={(v) => set("city", v)} restrict={stripDigits} />
              <Field label="State" value={form.state} onChange={(v) => set("state", v)} />
              <Field label="ZIP *" value={form.zip} onChange={(v) => set("zip", v)} restrict={(v) => digitsOnly(v, 5)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Property Type *</label>
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
              <Field label="MLS Number *" value={form.mlsNumber} onChange={(v) => set("mlsNumber", v)} restrict={(v) => digitsOnly(v, 10)} />
              <Field label="Year Built" type="number" value={form.yearBuilt} onChange={(v) => set("yearBuilt", v)} placeholder="e.g. 2005" restrict={(v) => digitsOnly(v, 4)} />
            </div>
            <div className="border-t border-[#1B1B1B]/5 pt-5 space-y-4">
              <SectionLabel className="text-center">Optional Info</SectionLabel>
              <TextareaField
                label="Legal Description"
                value={form.legalDescription}
                onChange={(v) => set("legalDescription", v)}
                placeholder="Lot, block, tract…"
              />
              <div className="grid grid-cols-2 gap-4">
                <TextareaField
                  label="Property Includes"
                  value={form.propertyIncludes}
                  onChange={(v) => set("propertyIncludes", v)}
                  placeholder="Refrigerator, washer/dryer…"
                  rows={2}
                />
                <TextareaField
                  label="Property Excludes"
                  value={form.propertyExcludes}
                  onChange={(v) => set("propertyExcludes", v)}
                  placeholder="Wall-mounted TV brackets…"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Multi-Parcels</label>
                  <select
                    value={form.numberOfParcels}
                    onChange={(e) => set("numberOfParcels", e.target.value)}
                    className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
                  >
                    <option value="">—</option>
                    {MULTI_PARCEL_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <Field label="Tax ID / APN" value={form.taxId} onChange={(v) => set("taxId", v)} placeholder="Optional" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="School District" value={form.schoolDistrict} onChange={(v) => set("schoolDistrict", v)} placeholder="Optional" />
                <Field label="Zoning Class" value={form.zoningClass} onChange={(v) => set("zoningClass", v)} placeholder="e.g. R-1" />
              </div>
              <div className="text-center">
                <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Property Photo</label>
                <label
                  className={`inline-flex cursor-pointer items-center rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                    photoUploading ? "bg-zinc-100 text-zinc-400" : "bg-[#1B1B1B] text-white hover:bg-[#1B1B1B]/80"
                  }`}
                >
                  {photoUploading ? "Uploading…" : form.photoKey ? "Replace Photo" : "Upload Photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={photoUploading}
                    onChange={handlePhotoChange}
                  />
                </label>
                {form.photoKey && !photoUploading && (
                  <p className="mt-1.5 text-xs text-[#9E8C61]">Photo uploaded ✓</p>
                )}
              </div>
            </div>
          </div>
          )
        )}

        {/* ── Step 2: Transaction Details ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {isLeaseSide ? (
                <>
                  <Field label="Total Lease Amount *" value={form.leasePrice} onChange={(v) => set("leasePrice", v)} placeholder="$" formatCommas />
                  <Field label="Deposit" value={form.deposit} onChange={(v) => set("deposit", v)} placeholder="$" formatCommas />
                </>
              ) : (
                <>
                  <Field label="List Price" value={form.listPrice} onChange={(v) => set("listPrice", v)} placeholder="$" formatCommas />
                  <Field label="Sale / Purchase Price *" value={form.salePrice} onChange={(v) => set("salePrice", v)} placeholder="$" formatCommas />
                </>
              )}
            </div>
            {!isLeaseSide && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Deposit" value={form.deposit} onChange={(v) => set("deposit", v)} placeholder="$" formatCommas />
                <Field label="Escrow Number" value={form.escrowNumber} onChange={(v) => set("escrowNumber", v)} placeholder="Optional" />
              </div>
            )}
            <div className="border-t border-[#1B1B1B]/5 pt-5">
              <SectionLabel className="text-center">Offer</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <DateFieldRow label="Offer Date" value={form.offerDate} onChange={(v) => set("offerDate", v)} />
                <DateFieldRow label="Offer Expiration Date" value={form.offerExpirationDate} onChange={(v) => set("offerExpirationDate", v)} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <DateFieldRow label="Acceptance Date" value={form.acceptanceDate} onChange={(v) => set("acceptanceDate", v)} />
                <DateFieldRow label="Close of Escrow" value={form.closeOfEscrow} onChange={(v) => set("closeOfEscrow", v)} />
              </div>
            </div>
            <div className="border-t border-[#1B1B1B]/5 pt-5">
              <SectionLabel className="text-center">Key Deadlines</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <DateFieldRow label="Inspection Deadline" value={form.inspectionDeadline} onChange={(v) => set("inspectionDeadline", v)} />
                <DateFieldRow label="Appraisal Deadline" value={form.appraisalDeadline} onChange={(v) => set("appraisalDeadline", v)} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <DateFieldRow label="Loan Approval Deadline" value={form.loanApprovalDeadline} onChange={(v) => set("loanApprovalDeadline", v)} />
                <DateFieldRow label="Final Walkthrough Date" value={form.finalWalkthroughDate} onChange={(v) => set("finalWalkthroughDate", v)} />
              </div>
              <div className="mt-4">
                <DateFieldRow label="Possession Date" value={form.possessionDate} onChange={(v) => set("possessionDate", v)} />
              </div>
            </div>
            <div className="border-t border-[#1B1B1B]/5 pt-5">
              <ConditionsSection conditions={conditions} onUpdate={setConditions} />
            </div>
          </div>
        )}

        {/* ── Step 3: Parties ── */}
        {step === 3 && (
          <div className="space-y-8">
            <PartySection label={isLeaseSide ? "Tenants" : "Buyers"} parties={buyers} onUpdate={setBuyers} required={buyerSectionRequired} />
            <PartySection label={isLeaseSide ? "Landlords" : "Sellers"} parties={sellers} onUpdate={setSellers} required={sellerSectionRequired} />

            {/* Listing Agent */}
            <div>
              <p className="mb-3 text-center text-sm font-semibold text-[#1B1B1B]/60">Listing Agent</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" value={listingAgent.name} onChange={(v) => setListingAgent((a) => ({ ...a, name: v }))} restrict={stripDigits} />
                <Field label="Email" type="email" value={listingAgent.email} onChange={(v) => setListingAgent((a) => ({ ...a, email: v }))} error={emailError(listingAgent.email)} />
                <Field label="Phone" type="tel" value={listingAgent.phone} onChange={(v) => setListingAgent((a) => ({ ...a, phone: v }))} restrict={formatPhoneInput} />
                <Field label="License #" value={listingAgent.licenseNumber} onChange={(v) => setListingAgent((a) => ({ ...a, licenseNumber: v }))} />
                <div className="col-span-2">
                  <Field label="Brokerage" value={listingAgent.company} onChange={(v) => setListingAgent((a) => ({ ...a, company: v }))} />
                </div>
              </div>
            </div>

            {/* Title / Escrow / Attorney — the toggle only changes which type's fields
                are on screen; each type keeps its own values underneath. */}
            <div>
              <p className="mb-3 text-center text-sm font-semibold text-[#1B1B1B]/60">Title / Escrow / Attorney</p>
              <div className="mb-4 flex justify-center gap-2">
                {(["Title", "Escrow", "Attorney"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveEscrowType(type)}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${activeEscrowType === type ? "bg-[#1B1B1B] text-white" : "bg-[#F2F0EF] text-[#1B1B1B]/60 hover:text-[#1B1B1B]"}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" value={escrowContacts[activeEscrowType].name} onChange={(v) => setEscrowContacts((c) => ({ ...c, [activeEscrowType]: { ...c[activeEscrowType], name: v } }))} restrict={stripDigits} />
                <Field label="Email" type="email" value={escrowContacts[activeEscrowType].email} onChange={(v) => setEscrowContacts((c) => ({ ...c, [activeEscrowType]: { ...c[activeEscrowType], email: v } }))} error={emailError(escrowContacts[activeEscrowType].email)} />
                <Field label="Phone" type="tel" value={escrowContacts[activeEscrowType].phone} onChange={(v) => setEscrowContacts((c) => ({ ...c, [activeEscrowType]: { ...c[activeEscrowType], phone: v } }))} restrict={formatPhoneInput} />
                <Field label="Company" value={escrowContacts[activeEscrowType].company} onChange={(v) => setEscrowContacts((c) => ({ ...c, [activeEscrowType]: { ...c[activeEscrowType], company: v } }))} />
              </div>
            </div>

            <OptionalPartySection
              label="Loan Officer"
              show={showLoanOfficer}
              onToggle={() => setShowLoanOfficer((v) => !v)}
              party={loanOfficer}
              onUpdate={setLoanOfficer}
            />
            <OptionalPartySection
              label="Transaction Coordinator"
              show={showTc}
              onToggle={() => setShowTc((v) => !v)}
              party={tc}
              onUpdate={setTc}
            />
            <OptionalPartySection
              label="Referral Agent"
              show={showReferralAgent}
              onToggle={() => setShowReferralAgent((v) => !v)}
              party={referralAgent}
              onUpdate={setReferralAgent}
            />
          </div>
        )}

        {/* ── Step 4: Commission ── */}
        {step === 4 && (
          <div className="space-y-5">
            {isLeaseSide ? (
              <CommissionField
                label="Lease Commission"
                value={form.saleCommission}
                onChange={(v) => set("saleCommission", v)}
                mode={commissionMode.sale}
                onModeChange={(m) => setCommissionMode((prev) => ({ ...prev, sale: m }))}
                hideModeToggle
              />
            ) : (
              <>
                {form.transactionSide !== "LISTING" && (
                  <CommissionField
                    label="Selling Agent Commission"
                    value={form.saleCommission}
                    onChange={(v) => set("saleCommission", v)}
                    mode={commissionMode.sale}
                    onModeChange={(m) => setCommissionMode((prev) => ({ ...prev, sale: m }))}
                  />
                )}
                {form.transactionSide !== "PURCHASE" && (
                  <CommissionField
                    label="Listing Agent Commission"
                    value={form.listingCommission}
                    onChange={(v) => set("listingCommission", v)}
                    mode={commissionMode.listing}
                    onModeChange={(m) => setCommissionMode((prev) => ({ ...prev, listing: m }))}
                  />
                )}
              </>
            )}
            <Field
              label="Other Deductions ($)"
              value={form.otherDeductions}
              onChange={(v) => set("otherDeductions", v)}
              formatCommas
            />
            <ToggleRow
              label="CnC TC Service"
              sublabel={`In-house transaction coordinator — $${TC_FEE}`}
              checked={tcFeeEnabled}
              onChange={() => setTcFeeEnabled((v) => !v)}
            />
            {!isLeaseSide && (
              <>
                <ToggleRow
                  label="Agent-Relative Sale"
                  sublabel="Buyer or seller is a relative of the representing agent"
                  checked={agentRelativeSale}
                  onChange={() => setAgentRelativeSale((v) => !v)}
                />
                <ToggleRow
                  label="Broker-Provided Lead"
                  sublabel="This transaction originated from a CnC-provided lead"
                  checked={brokerProvidedLead}
                  onChange={() => setBrokerProvidedLead((v) => !v)}
                />
              </>
            )}
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
            {(salePrice > 0 || leasePrice > 0 || totalGci > 0) && (
              <div className="rounded-xl border border-[#1B1B1B]/8 bg-[#F2F0EF] p-5 space-y-2 text-sm">
                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-[#1B1B1B]/40">
                  Commission Breakdown
                </p>
                <BdRow
                  label={isLeaseSide ? "Total Lease Amount" : "Purchase Price"}
                  value={`$${(isLeaseSide ? leasePrice : salePrice).toLocaleString()}`}
                />
                {isLeaseSide ? (
                  <BdRow
                    label="Lease Commission"
                    value={saleCommissionAmt > 0 ? `$${fmtAmt(saleCommissionAmt)}` : "—"}
                  />
                ) : (
                  <>
                    {form.transactionSide !== "LISTING" && (
                      <BdRow
                        label="Selling Agent Commission"
                        value={saleCommissionAmt > 0 ? `$${fmtAmt(saleCommissionAmt)}` : "—"}
                      />
                    )}
                    {form.transactionSide !== "PURCHASE" && (
                      <BdRow
                        label="Listing Agent Commission"
                        value={listingCommissionAmt > 0 ? `$${fmtAmt(listingCommissionAmt)}` : "—"}
                      />
                    )}
                  </>
                )}
                <BdRow
                  label={transactionFee.label}
                  value={transactionFee.baseFee > 0 ? `−$${fmtAmt(transactionFee.baseFee)}` : "—"}
                  muted
                />
                {transactionFee.hasEoInsurance && (
                  <BdRow
                    label="E&O Insurance"
                    value={transactionFee.eoSupplement > 0 ? `−$${fmtAmt(transactionFee.eoSupplement)}` : "FREE"}
                    muted
                  />
                )}
                {otherDeductionsAmt > 0 && (
                  <BdRow label="Other Deductions" value={`−$${fmtAmt(otherDeductionsAmt)}`} muted />
                )}
                {tcFeeEnabled && (
                  <BdRow label="CnC TC Service" value={`−$${fmtAmt(TC_FEE)}`} muted />
                )}
                <div className="border-t border-[#1B1B1B]/10 pt-2">
                  <div className="flex justify-between font-semibold text-[#1B1B1B]">
                    <span>Net to Agent</span>
                    <span>{netToAgent > 0 ? `$${fmtAmt(netToAgent)}` : "—"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Review ── */}
        {step === 5 && (
          isReferral ? (
            <div className="space-y-3">
              <ReviewRow label="Referred-To Agent" value={form.referredToAgentName} />
              <ReviewRow label="Referred-To Brokerage" value={form.referredToBrokerageName || "—"} />
              <ReviewRow label="Contact" value={form.referredToContactEmail || form.referredToContactPhone || "—"} />
              <ReviewRow label="Date Referred" value={form.dateReferred || "—"} />
            </div>
          ) : (
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
              {form.numberOfParcels && <ReviewRow label="Multi-Parcels" value={`${form.numberOfParcels} parcels`} />}
              {form.taxId && <ReviewRow label="Tax ID / APN" value={form.taxId} />}
              {form.schoolDistrict && <ReviewRow label="School District" value={form.schoolDistrict} />}
              {form.zoningClass && <ReviewRow label="Zoning Class" value={form.zoningClass} />}
            </ReviewSection>
            <ReviewSection title="Transaction Details">
              {form.salePrice && <ReviewRow label="Sale Price" value={`$${Number(form.salePrice).toLocaleString()}`} />}
              {form.leasePrice && <ReviewRow label="Total Lease Amount" value={`$${Number(form.leasePrice).toLocaleString()}`} />}
              {form.deposit && <ReviewRow label="Deposit" value={`$${Number(form.deposit).toLocaleString()}`} />}
              {form.closeOfEscrow && <ReviewRow label="Close of Escrow" value={form.closeOfEscrow} />}
              {form.offerDate && <ReviewRow label="Offer Date" value={form.offerDate} />}
              {form.offerExpirationDate && <ReviewRow label="Offer Expiration Date" value={form.offerExpirationDate} />}
              {form.acceptanceDate && <ReviewRow label="Acceptance Date" value={form.acceptanceDate} />}
              {form.finalWalkthroughDate && <ReviewRow label="Final Walkthrough Date" value={form.finalWalkthroughDate} />}
              {form.possessionDate && <ReviewRow label="Possession Date" value={form.possessionDate} />}
              {form.escrowNumber && <ReviewRow label="Escrow #" value={form.escrowNumber} />}
            </ReviewSection>
            {conditions.filter((c) => c.name).length > 0 && (
              <ReviewSection title="Contingencies">
                {conditions.filter((c) => c.name).map((c, i) => (
                  <ReviewRow key={i} label={c.name} value={c.dueDate || "—"} />
                ))}
              </ReviewSection>
            )}
            <ReviewSection title="Parties">
              {buyers.filter((b) => b.name).map((b, i) => (
                <ReviewRow key={i} label={`${isLeaseSide ? "Tenant" : "Buyer"} ${buyers.length > 1 ? i + 1 : ""}`} value={b.name} />
              ))}
              {sellers.filter((s) => s.name).map((s, i) => (
                <ReviewRow key={i} label={`${isLeaseSide ? "Landlord" : "Seller"} ${sellers.length > 1 ? i + 1 : ""}`} value={s.name} />
              ))}
              {listingAgent.name && <ReviewRow label="Listing Agent" value={listingAgent.name} />}
              {(["Title", "Escrow", "Attorney"] as const)
                .filter((t) => escrowContacts[t].name)
                .map((t) => <ReviewRow key={t} label={t} value={escrowContacts[t].name} />)}
              {showLoanOfficer && loanOfficer.name && <ReviewRow label="Loan Officer" value={loanOfficer.name} />}
              {showTc && tc.name && <ReviewRow label="Transaction Coordinator" value={tc.name} />}
              {showReferralAgent && referralAgent.name && <ReviewRow label="Referral Agent" value={referralAgent.name} />}
            </ReviewSection>
            <ReviewSection title="Commission">
              {totalGci > 0 && <ReviewRow label="Total GCI" value={`$${Math.round(totalGci).toLocaleString()}`} />}
              <ReviewRow label={transactionFee.label} value={transactionFee.fee > 0 ? `$${Math.round(transactionFee.fee).toLocaleString()}` : "—"} />
              {otherDeductionsAmt > 0 && <ReviewRow label="Deductions" value={`$${otherDeductionsAmt.toLocaleString()}`} />}
              {tcFeeEnabled && <ReviewRow label="CnC TC Service" value={`$${TC_FEE}`} />}
              {netToAgent > 0 && <ReviewRow label="Net to Agent" value={`$${Math.round(netToAgent).toLocaleString()}`} />}
            </ReviewSection>
          </div>
          )
        )}
      </div>

      {/* Navigation */}
      {/* Both guards below rely on referral's reused Review index (5) being >= STEPS.length - 1
          for the 3-step referral bar — correct today, but would break if the reused index ever changed. */}
      <div className="mt-16 flex items-center justify-center gap-3">
        {step > 0 && (
          <button
            onClick={goBack}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#1B1B1B]/20 px-6 py-2.5 text-sm text-[#1B1B1B]/60 hover:border-[#1B1B1B]/40 hover:text-[#1B1B1B]"
          >
            <ArrowIcon style={{ rotate: "90deg" }} /> Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <motion.button
            onClick={goNext}
            disabled={!canAdvance}
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
            {saving ? <><Spinner className="mr-2 h-4 w-4" />Creating…</> : "Create Transaction"}
          </motion.button>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`mb-4 text-xs font-semibold uppercase tracking-widest text-[#1B1B1B]/40 ${className}`}>{children}</p>
  );
}

function OptionCard({
  selected, onClick, label, desc, className = "",
}: {
  selected: boolean; onClick: () => void; label: string; desc?: string; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-6 text-center transition-colors ${selected ? "border-[#9E8C61] bg-[#9E8C61]/5" : "border-[#1B1B1B]/10 hover:border-[#1B1B1B]/25"} ${className}`}
    >
      <p className="font-semibold text-[#1B1B1B]">{label}</p>
      {desc && <p className="mt-1 text-xs text-[#1B1B1B]/40">{desc}</p>}
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

function TextareaField({
  label, value, onChange, placeholder = "", rows = 3,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/25 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
      />
    </div>
  );
}

function PartySection({
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
              <Field label={`${singular} Name${required ? " *" : ""}`} value={p.name} onChange={(v) => update(i, "name", v)} restrict={stripDigits} />
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

// Single-optional-party sections (Loan Officer, Transaction Coordinator,
// Referral Agent) — closed state shows "+ Add X"; open state shows a
// bordered card with a trash-can icon to remove, matching the same
// remove-icon pattern used for Contingencies and individual party cards
// above, instead of a "+ Remove X" text toggle.
function OptionalPartySection({
  label, show, onToggle, party, onUpdate,
}: {
  label: string; show: boolean; onToggle: () => void; party: Party; onUpdate: (p: Party) => void;
}) {
  if (!show) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-sm font-medium text-[#9E8C61] hover:text-[#7a6d4a]"
      >
        <Plus size={15} /> Add {label}
      </button>
    );
  }
  return (
    <div className="relative rounded-xl border border-[#1B1B1B]/8 p-4">
      <button
        onClick={onToggle}
        className="absolute right-3 top-3 text-[#1B1B1B]/25 hover:text-red-400"
      >
        <TrashIcon size={14} />
      </button>
      <p className="mb-3 text-sm font-semibold text-[#1B1B1B]/60">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" value={party.name} onChange={(v) => onUpdate({ ...party, name: v })} restrict={stripDigits} />
        <Field label="Email" type="email" value={party.email} onChange={(v) => onUpdate({ ...party, email: v })} error={emailError(party.email)} />
        <Field label="Phone" type="tel" value={party.phone} onChange={(v) => onUpdate({ ...party, phone: v })} restrict={formatPhoneInput} />
        <Field label="Company" value={party.company} onChange={(v) => onUpdate({ ...party, company: v })} />
      </div>
    </div>
  );
}

type Condition = { name: string; dueDate: string; notes: string };
const emptyCondition = (): Condition => ({ name: "", dueDate: "", notes: "" });

function ConditionsSection({
  conditions, onUpdate,
}: {
  conditions: Condition[]; onUpdate: (c: Condition[]) => void;
}) {
  function update(i: number, field: keyof Condition, value: string) {
    onUpdate(conditions.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }
  return (
    <div>
      <SectionLabel className="text-center">Contingencies</SectionLabel>
      <button
        onClick={() => onUpdate([...conditions, emptyCondition()])}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-[#9E8C61] hover:text-[#7a6d4a]"
      >
        <Plus size={15} /> Add Contingency
      </button>
      <div className="space-y-3">
        {conditions.map((c, i) => (
          <div key={i} className="relative rounded-xl border border-[#1B1B1B]/8 p-4">
            <button
              onClick={() => onUpdate(conditions.filter((_, idx) => idx !== i))}
              className="absolute right-3 top-3 text-[#1B1B1B]/25 hover:text-red-400"
            >
              <TrashIcon size={14} />
            </button>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Condition Name" value={c.name} onChange={(v) => update(i, "name", v)} placeholder="e.g. Inspection Contingency" />
              <DateFieldRow label="Due Date" value={c.dueDate} onChange={(v) => update(i, "dueDate", v)} />
            </div>
            <div className="mt-3">
              <Field label="Notes" value={c.notes} onChange={(v) => update(i, "notes", v)} placeholder="Optional" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommissionField({
  label, value, onChange, mode, onModeChange, hideModeToggle = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  mode: "pct" | "flat"; onModeChange: (m: "pct" | "flat") => void;
  hideModeToggle?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-medium text-[#1B1B1B]/50">{label}</label>
        {!hideModeToggle && (
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
        )}
      </div>
      {mode === "flat" ? (
        <input
          type="text"
          inputMode="decimal"
          value={formatCurrencyDisplay(value)}
          onChange={(e) => onChange(sanitizeCurrencyInput(e.target.value, 12))}
          placeholder="e.g. 15,000"
          className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/25 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
        />
      ) : (
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(sanitizeCurrencyInput(e.target.value, 3))}
          placeholder="e.g. 2.5"
          className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/25 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
        />
      )}
    </div>
  );
}

function ToggleRow({
  label, sublabel, checked, onChange,
}: {
  label: string; sublabel: string; checked: boolean; onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-3">
      <div>
        <p className="text-sm font-medium text-[#1B1B1B]">{label}</p>
        <p className="text-xs text-[#1B1B1B]/40">{sublabel}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-[#9E8C61]" : "bg-[#1B1B1B]/20"}`}
      >
        <span
          className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
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
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-[#1B1B1B]/40">{title}</p>
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
