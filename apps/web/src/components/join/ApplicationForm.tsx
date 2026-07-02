"use client";

import { useState, useCallback } from "react";
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { RevealLine } from "@/components/ui/reveal-text";

const inputClass =
  "w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-4 py-3 text-sm text-[#1B1B1B] placeholder-[#1B1B1B]/40 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/40";
const labelClass =
  "mb-1 block text-xs font-medium text-[#1B1B1B]/60 uppercase tracking-wide text-left";
const sectionClass = "mb-10";
const sectionHeadingClass =
  "mb-6 font-sans text-xl font-medium uppercase tracking-widest text-[#9E8C61]";

type LicenseType = "SALESPERSON" | "BROKER_ASSOCIATE";
type CommissionEntity = "PERSONAL" | "LLC" | "S_CORP" | "C_CORP";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dateOfBirth: string;
  licenseNumber: string;
  licenseType: LicenseType | "";
  licenseExpDate: string;
  yearsLicensed: string;
  formerBrokerage: string;
  boardOfRealtors: string;
  mlsId: string;
  hasActiveListings: boolean | null;
  hasActiveSales: boolean | null;
  commissionEntity: CommissionEntity | "";
  hasDisciplinaryHistory: boolean | null;
  disciplinaryExplain: string;
  hasInvestigationHistory: boolean | null;
  investigationExplain: string;
  backgroundCheckConsent: boolean;
  icaAgreed: boolean;
  drePerJuryCert: boolean;
}

const INITIAL: FormState = {
  firstName: "", lastName: "", email: "", phone: "",
  address: "", city: "", state: "CA", zip: "", dateOfBirth: "",
  licenseNumber: "", licenseType: "", licenseExpDate: "", yearsLicensed: "",
  formerBrokerage: "", boardOfRealtors: "", mlsId: "",
  hasActiveListings: null, hasActiveSales: null,
  commissionEntity: "",
  hasDisciplinaryHistory: null, disciplinaryExplain: "",
  hasInvestigationHistory: null, investigationExplain: "",
  backgroundCheckConsent: false,
  icaAgreed: false, drePerJuryCert: false,
};

function FormInner() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [icaOpened, setIcaOpened] = useState(false);
  const [icaOpenedAt, setIcaOpenedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { executeRecaptcha } = useGoogleReCaptcha();

  const set = (field: keyof FormState, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    const formatted =
      digits.length <= 3 ? digits :
      digits.length <= 6 ? `${digits.slice(0, 3)}-${digits.slice(3)}` :
      `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    set("phone", formatted);
  };


  const handleIcaClick = () => {
    if (!icaOpened) {
      setIcaOpened(true);
      setIcaOpenedAt(new Date().toISOString());
    }
    window.open("/join/ica", "_blank");
  };

  const handleSubmit = useCallback(async () => {
    setError(null);

    // Basic client-side validation
    if (!form.firstName || !form.lastName || !form.email || !form.phone) {
      setError("Please fill out all required personal information fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!/^\d{8}$/.test(form.licenseNumber)) {
      setError("CA DRE License Number must be exactly 8 digits.");
      return;
    }
    if (!form.licenseType || !form.licenseExpDate || !form.yearsLicensed || !form.formerBrokerage) {
      setError("Please fill out all required license information fields.");
      return;
    }
    if (form.hasActiveListings === null || form.hasActiveSales === null) {
      setError("Please answer both transfer questions.");
      return;
    }
    if (!form.commissionEntity) {
      setError("Please select your commission deposit type.");
      return;
    }
    if (form.hasDisciplinaryHistory === null || form.hasInvestigationHistory === null) {
      setError("Please answer all background disclosure questions.");
      return;
    }
    if (!form.backgroundCheckConsent) {
      setError("Background check consent is required.");
      return;
    }
    if (!icaOpened) {
      setError("Please read the ICA before agreeing to it.");
      return;
    }
    if (!form.icaAgreed) {
      setError("You must agree to the Independent Contractor Agreement.");
      return;
    }
    if (!form.drePerJuryCert) {
      setError("DRE perjury certification is required.");
      return;
    }

    if (!executeRecaptcha) {
      setError("reCAPTCHA not ready. Please try again.");
      return;
    }

    setSubmitting(true);
    try {
      const recaptchaToken = await executeRecaptcha("agent_application");
      const icaAgreedAt = new Date().toISOString();

      const res = await fetch("/api/agent-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          yearsLicensed: parseInt(form.yearsLicensed, 10) || 0,
          icaOpenedAt: icaOpenedAt!,
          icaAgreedAt,
          recaptchaToken,
        }),
      });

      const data = await res.json();
      if (res.status !== 201) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [form, icaOpened, icaOpenedAt, executeRecaptcha]);

  if (success) {
    return (
      <div className="py-16 text-center">
        <p className="font-sans text-2xl font-light text-[#1B1B1B]">Application submitted!</p>
        <p className="mt-3 font-sans text-sm text-[#1B1B1B]/60">
          We&apos;ll review your application and be in touch within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-32">
      <h1 className="mb-20 text-center font-sans text-[2.5rem] font-light xl:text-[3rem]">
        <RevealLine>
          <span className="text-[1.9rem] xl:text-[2.2rem]">Welcome to </span>
          <span className="font-medium text-[#9E8C61]">CnC Realty</span>
        </RevealLine>
      </h1>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* ── Section 1: Personal Information ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>Personal Information</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>First Name *</label>
            <input className={inputClass} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Last Name *</label>
            <input className={inputClass} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Email *</label>
            <input className={inputClass} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Cell Phone *</label>
            <input className={inputClass} type="tel" value={form.phone} onChange={handlePhoneChange} />
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>Street Address *</label>
          <input className={inputClass} value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>City *</label>
            <input className={inputClass} value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>State *</label>
            <input className={inputClass} value={form.state} onChange={(e) => set("state", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>ZIP Code *</label>
            <input className={inputClass} value={form.zip} maxLength={5} onChange={(e) => set("zip", e.target.value.replace(/\D/g, "").slice(0, 5))} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Date of Birth *</label>
            <input className={inputClass} type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} style={{ color: form.dateOfBirth ? "#1B1B1B" : "rgba(27,27,27,0.4)" }} />
          </div>
        </div>
        <p className="mt-3 font-sans text-sm text-[#1B1B1B]/50">* indicates required</p>
      </div>

      {/* ── Section 2: License Information ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>License Information</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>CA DRE License # *</label>
            <input className={inputClass} value={form.licenseNumber} maxLength={8} onChange={(e) => set("licenseNumber", e.target.value.replace(/\D/g, "").slice(0, 8))} />
          </div>
          <div>
            <label className={labelClass}>License Expiration Date *</label>
            <input className={inputClass} type="date" value={form.licenseExpDate} onChange={(e) => set("licenseExpDate", e.target.value)} style={{ color: form.licenseExpDate ? "#1B1B1B" : "rgba(27,27,27,0.4)" }} />
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>License Type *</label>
          <div className="mt-2 flex gap-6">
            {(["SALESPERSON", "BROKER_ASSOCIATE"] as LicenseType[]).map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 font-sans text-sm text-[#1B1B1B]">
                <input
                  type="radio"
                  name="licenseType"
                  value={t}
                  checked={form.licenseType === t}
                  onChange={() => set("licenseType", t)}
                  className="accent-[#9E8C61]"
                />
                {t === "SALESPERSON" ? "Salesperson" : "Broker"}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Years Licensed *</label>
            <input className={inputClass} type="number" min={0} max={99} value={form.yearsLicensed} onChange={(e) => set("yearsLicensed", e.target.value.slice(0, 2))} />
          </div>
          <div>
            <label className={labelClass}>Current or Most Recent Brokerage *</label>
            <input className={inputClass} value={form.formerBrokerage} onChange={(e) => set("formerBrokerage", e.target.value)} placeholder="N/A if not applicable" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Board of Realtors</label>
            <input className={inputClass} value={form.boardOfRealtors} onChange={(e) => set("boardOfRealtors", e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className={labelClass}>MLS ID</label>
            <input className={inputClass} value={form.mlsId} onChange={(e) => set("mlsId", e.target.value)} placeholder="Optional" />
          </div>
        </div>
      </div>

      {/* ── Section 3: Active Listings & Sales ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>Active Listings & Sales</p>
        <p className="mb-4 font-sans text-sm text-[#1B1B1B]/50">
          If yes, your current broker will need to release them to CnC Realty.
        </p>
        {(
          [
            { field: "hasActiveListings", label: "Do you have active listings to transfer? *" },
            { field: "hasActiveSales", label: "Do you have pending sales to transfer? *" },
          ] as const
        ).map(({ field, label }) => (
          <div key={field} className="mb-4">
            <label className={labelClass}>{label}</label>
            <div className="mt-2 flex gap-6">
              {([true, false] as const).map((val) => (
                <label key={String(val)} className="flex cursor-pointer items-center gap-2 font-sans text-sm text-[#1B1B1B]">
                  <input
                    type="radio"
                    name={field}
                    checked={form[field] === val}
                    onChange={() => set(field, val)}
                    className="accent-[#9E8C61]"
                  />
                  {val ? "Yes" : "No"}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Section 4: Business & Tax ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>Business & Tax Information</p>
        <p className="mb-4 font-sans text-sm text-[#1B1B1B]/50">
          Required for W-9 purposes. A W-9 will be sent separately after approval.
        </p>
        <label className={labelClass}>Commission payments deposited to *</label>
        <div className="mt-2 flex flex-wrap gap-x-10 gap-y-2">
          {(
            [
              { value: "PERSONAL", label: "Personal Account" },
              { value: "LLC", label: "LLC" },
              { value: "S_CORP", label: "S Corporation" },
              { value: "C_CORP", label: "C Corporation" },
            ] as { value: CommissionEntity; label: string }[]
          ).map(({ value, label }) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 font-sans text-sm text-[#1B1B1B]">
              <input
                type="radio"
                name="commissionEntity"
                value={value}
                checked={form.commissionEntity === value}
                onChange={() => set("commissionEntity", value)}
                className="accent-[#9E8C61]"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* ── Section 5: Background & Disclosures ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>Background & Disclosures</p>
        <div className="mb-4">
          <label className={labelClass}>
            Have you ever been disciplined by any Local, State, or Federal entity? *
          </label>
          <div className="mt-2 flex gap-6">
            {([true, false] as const).map((val) => (
              <label key={String(val)} className="flex cursor-pointer items-center gap-2 font-sans text-sm text-[#1B1B1B]">
                <input
                  type="radio"
                  name="hasDisciplinaryHistory"
                  checked={form.hasDisciplinaryHistory === val}
                  onChange={() => set("hasDisciplinaryHistory", val)}
                  className="accent-[#9E8C61]"
                />
                {val ? "Yes" : "No"}
              </label>
            ))}
          </div>
          {form.hasDisciplinaryHistory === true && (
            <textarea
              className={`${inputClass} mt-3 resize-none`}
              rows={3}
              placeholder="Please explain..."
              value={form.disciplinaryExplain}
              onChange={(e) => set("disciplinaryExplain", e.target.value)}
            />
          )}
        </div>
        <div className="mb-4">
          <label className={labelClass}>
            Are you currently under investigation or prosecution by the DRE or any government agency? *
          </label>
          <div className="mt-2 flex gap-6">
            {([true, false] as const).map((val) => (
              <label key={String(val)} className="flex cursor-pointer items-center gap-2 font-sans text-sm text-[#1B1B1B]">
                <input
                  type="radio"
                  name="hasInvestigationHistory"
                  checked={form.hasInvestigationHistory === val}
                  onChange={() => set("hasInvestigationHistory", val)}
                  className="accent-[#9E8C61]"
                />
                {val ? "Yes" : "No"}
              </label>
            ))}
          </div>
          {form.hasInvestigationHistory === true && (
            <textarea
              className={`${inputClass} mt-3 resize-none`}
              rows={3}
              placeholder="Please explain..."
              value={form.investigationExplain}
              onChange={(e) => set("investigationExplain", e.target.value)}
            />
          )}
        </div>
        <label className="flex cursor-pointer items-start gap-3 font-sans text-sm text-[#1B1B1B]">
          <input
            type="checkbox"
            checked={form.backgroundCheckConsent}
            onChange={(e) => set("backgroundCheckConsent", e.target.checked)}
            className="mt-0.5 accent-[#9E8C61]"
          />
          I consent to CnC Realty performing a background check before or after onboarding. *
        </label>
      </div>

      {/* ── Section 6: ICA Review & Agreement ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>Independent Contractor Agreement</p>
        <p className="mb-4 font-sans text-sm text-[#1B1B1B]/50">
          Please read the CnC Realty ICA before agreeing below.
        </p>
        <button
          type="button"
          onClick={handleIcaClick}
          className="mb-4 inline-flex items-center gap-1 rounded-full border border-[#9E8C61] px-5 py-2.5 font-sans text-sm font-medium text-[#9E8C61] transition-colors hover:bg-[#9E8C61]/5"
        >
          Read the CnC Realty ICA →
        </button>
        {icaOpened && (
          <p className="mb-3 font-sans text-xs text-[#1B1B1B]/40">
            Opened at {new Date(icaOpenedAt!).toLocaleTimeString()}
          </p>
        )}
        <label
          className={`flex cursor-pointer items-start gap-3 font-sans text-sm text-[#1B1B1B] ${
            !icaOpened ? "cursor-not-allowed opacity-40" : ""
          }`}
        >
          <input
            type="checkbox"
            disabled={!icaOpened}
            checked={form.icaAgreed}
            onChange={(e) => set("icaAgreed", e.target.checked)}
            className="mt-0.5 accent-[#9E8C61]"
          />
          I have read and agree to the CnC Realty Independent Contractor Agreement. *
        </label>
      </div>

      {/* ── Section 8: DRE Perjury Certification ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>DRE Certification</p>
        <label className="flex cursor-pointer items-start gap-3 font-sans text-sm text-[#1B1B1B]">
          <input
            type="checkbox"
            checked={form.drePerJuryCert}
            onChange={(e) => set("drePerJuryCert", e.target.checked)}
            className="mt-0.5 flex-shrink-0 accent-[#9E8C61]"
          />
          <span>
            I certify under penalty of perjury that all information provided in this application is true
            and correct, and that I am not under investigation or prosecution by the DRE, State of
            California, any Realtor Association, MLS, or any government entity for acts including but not
            limited to complaints, ethics violations, fraud, misconduct, or misrepresentation. *
          </span>
        </label>
      </div>

      {/* ── Submit ── */}
      <div className="mt-2">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-full bg-[#1B1B1B] py-4 font-sans text-sm font-medium text-white transition-colors hover:bg-[#1B1B1B]/85 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit Application"}
        </button>
        <p className="mt-3 text-center font-sans text-xs text-[#1B1B1B]/40">
          This site is protected by reCAPTCHA.
        </p>
      </div>
    </div>
  );
}

export function ApplicationForm() {
  return (
    <GoogleReCaptchaProvider reCaptchaKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ""}>
      <FormInner />
    </GoogleReCaptchaProvider>
  );
}
