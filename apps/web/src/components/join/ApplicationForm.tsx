"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { ChevronDown } from "lucide-react";
import { RevealLine } from "@/components/ui/reveal-text";
import { DateField } from "@/components/ui/DateField";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { namesMatch } from "@/lib/ica-signature";

const inputClass =
  "w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-4 py-3 text-sm text-[#1B1B1B] placeholder-[#1B1B1B]/40 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/40";
const MEMBER_ASSOCIATIONS = [
  "Arcadia", "Burbank", "Citrus Valley", "Coastal Mendocino", "Greater Downey", "Fresno",
  "Glendale", "High Desert", "Inglewood", "Inland Valleys", "Joshua Tree Gateway", "Laguna",
  "Lake County", "Mariposa County", "Merced County", "Montebello District", "Newport Beach",
  "North San Diego County", "North San Luis Obispo County", "Orange County", "Oroville",
  "Pacific Southwest", "Pacific West", "Palos Verdes Peninsula", "Paradise", "Pasadena-Foothills",
  "Pismo Coast", "Rancho Southeast", "San Luis Obispo Coastal", "Sierra North Valley", "South Bay",
  "Southland Regional", "Southwest Riverside County", "California Desert Inland Gateway",
  "Tri-Counties", "Ventura County Coastal", "West San Gabriel Valley",
] as const;
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
  desiredMembershipAssociation: string;
  mlsId: string;
  hasActiveListings: boolean | null;
  hasActiveSales: boolean | null;
  commissionEntity: CommissionEntity | "";
  hasDisciplinaryHistory: boolean | null;
  disciplinaryExplain: string;
  hasInvestigationHistory: boolean | null;
  investigationExplain: string;
  icaAgreed: boolean;
  signatureName: string;
  drePerJuryCert: boolean;
}

const INITIAL: FormState = {
  firstName: "", lastName: "", email: "", phone: "",
  address: "", city: "", state: "CA", zip: "", dateOfBirth: "",
  licenseNumber: "", licenseType: "", licenseExpDate: "", yearsLicensed: "",
  formerBrokerage: "", boardOfRealtors: "", desiredMembershipAssociation: "", mlsId: "",
  hasActiveListings: null, hasActiveSales: null,
  commissionEntity: "",
  hasDisciplinaryHistory: null, disciplinaryExplain: "",
  hasInvestigationHistory: null, investigationExplain: "",
  icaAgreed: false, signatureName: "", drePerJuryCert: false,
};

const CURRENT_YEAR = new Date().getFullYear();
const DOB_MIN_YEAR = CURRENT_YEAR - 120;
const DOB_MAX_YEAR = CURRENT_YEAR - 18;

function FormInner() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [icaOpened, setIcaOpened] = useState(false);
  const [icaOpenedAt, setIcaOpenedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { executeRecaptcha } = useGoogleReCaptcha();
  const router = useRouter();

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
    if (!form.licenseType || !form.licenseExpDate || !form.yearsLicensed) {
      setError("Please fill out all required license information fields.");
      return;
    }
    if (!form.boardOfRealtors) {
      setError("Please select your Current Membership Association.");
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
    if (!icaOpened) {
      setError("Please read the ICA before agreeing to it.");
      return;
    }
    if (!form.icaAgreed) {
      setError("You must agree to the Independent Contractor Agreement.");
      return;
    }
    if (!namesMatch(form.signatureName, form.firstName, form.lastName)) {
      setError("Your signature must match your full legal name (First + Last Name) entered above.");
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
      router.push("/join/apply/submitted");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [form, icaOpened, icaOpenedAt, executeRecaptcha, router]);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-32">
      <div className="mb-20 flex justify-center">
        <h1 className="font-sans font-light leading-[1.05]">
          <span className="block text-[1.9rem] xl:text-[2.2rem] text-[#1B1B1B]">
            <RevealLine delay={0}>Welcome to</RevealLine>
          </span>
          <span className="ml-[8.1rem] block text-[3rem] xl:ml-[9.6rem] xl:text-[3.6rem]">
            <RevealLine delay={0.15}>
              <span className="font-medium text-[#9E8C61]">CnC Realty</span>
            </RevealLine>
          </span>
        </h1>
      </div>

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
            <input
              className={`${inputClass} cursor-not-allowed bg-[#1B1B1B]/5 text-[#1B1B1B]/60`}
              value="CA"
              disabled
              readOnly
            />
          </div>
          <div>
            <label className={labelClass}>ZIP Code *</label>
            <input className={inputClass} value={form.zip} maxLength={5} onChange={(e) => set("zip", e.target.value.replace(/\D/g, "").slice(0, 5))} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Date of Birth *</label>
            <DateField
              value={form.dateOfBirth}
              onChange={(v) => set("dateOfBirth", v)}
              minYear={DOB_MIN_YEAR}
              maxYear={DOB_MAX_YEAR}
            />
          </div>
        </div>
        <p className="mt-3 font-sans text-sm text-[#1B1B1B]/50">* indicates required</p>
      </div>

      {/* ── Section 2: License Information ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>License Information</p>
        <div>
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
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>CA DRE License # *</label>
            <input className={inputClass} value={form.licenseNumber} maxLength={8} onChange={(e) => set("licenseNumber", e.target.value.replace(/\D/g, "").slice(0, 8))} />
          </div>
          <div>
            <label className={labelClass}>License Expiration Date *</label>
            <DateField value={form.licenseExpDate} onChange={(v) => set("licenseExpDate", v)} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Years Licensed *</label>
            <input className={inputClass} type="number" min={0} max={99} value={form.yearsLicensed} onChange={(e) => set("yearsLicensed", e.target.value.slice(0, 2))} />
          </div>
          <div>
            <label className={labelClass}>Current/Most Recent Brokerage (if applicable)</label>
            <input className={inputClass} value={form.formerBrokerage} onChange={(e) => set("formerBrokerage", e.target.value)} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Current Membership Association *</label>
            <div className="relative">
              <select
                className={`${inputClass} appearance-none pr-10`}
                value={form.boardOfRealtors}
                onChange={(e) => set("boardOfRealtors", e.target.value)}
                style={{ color: form.boardOfRealtors ? "#1B1B1B" : "rgba(27,27,27,0.4)" }}
              >
                <option value="" hidden></option>
                <option value="None" style={{ color: "rgba(27,27,27,0.6)" }}>None</option>
                {MEMBER_ASSOCIATIONS.map((a) => (
                  <option key={a} value={a} style={{ color: "rgba(27,27,27,0.6)" }}>{a}</option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-[#1B1B1B]/40"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>MLS ID</label>
            <input className={inputClass} value={form.mlsId} onChange={(e) => set("mlsId", e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>Desired Membership Association if not listed</label>
          <input className={inputClass} value={form.desiredMembershipAssociation} onChange={(e) => set("desiredMembershipAssociation", e.target.value)} />
        </div>
      </div>

      {/* ── Section 3: ICA Review & Agreement ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>Independent Contractor Agreement</p>
        <p className="mb-4 font-sans text-sm text-[#1B1B1B]/50">
          Please read the CnC Realty ICA before agreeing below.
        </p>
        <motion.button
          type="button"
          onClick={handleIcaClick}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.02, transition: SPRING_HOVER }}
          className="mb-4 inline-flex items-center gap-1 rounded-full border border-[#9E8C61] px-5 py-2.5 font-sans text-sm font-medium text-[#9E8C61] transition-colors hover:bg-[#9E8C61]/5"
        >
          CnC Realty ICA
        </motion.button>
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
        <div className="mt-4">
          <label className={labelClass}>Type your full legal name to sign *</label>
          <input
            className={inputClass}
            value={form.signatureName}
            onChange={(e) => set("signatureName", e.target.value)}
            disabled={!icaOpened}
          />
          <p className="mt-1 font-sans text-xs text-[#1B1B1B]/40">
            By typing your name above, you are electronically signing the CnC Realty Independent Contractor Agreement.
          </p>
        </div>
      </div>

      {/* ── Section 4: Active Listings & Sales ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>Active Listings & Sales</p>
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
            {form[field] === true && (
              <p className="mt-2 font-sans text-sm text-[#1B1B1B]/50">
                Please request your current brokerage to release active listings to CnC Realty after submission
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Section 5: Business & Tax ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>Business & Tax Information</p>
        <label className={labelClass}>Where is your commission deposited to (For W-9 purposes)? *</label>
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

      {/* ── Section 6: Background ── */}
      <div className={sectionClass}>
        <p className={sectionHeadingClass}>Background</p>
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
        <div className="mb-8">
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
        <label className="flex cursor-pointer items-start gap-3 font-sans text-sm text-[#1B1B1B]/60">
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
        <motion.button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.02, transition: SPRING_HOVER }}
          className="mx-auto block rounded-full bg-[#1B1B1B] px-16 py-4 font-sans text-sm font-medium text-white transition-colors hover:bg-[#1B1B1B]/85 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit Application"}
        </motion.button>
        <p className="mt-16 text-center font-sans text-xs text-[#1B1B1B]/40">
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
