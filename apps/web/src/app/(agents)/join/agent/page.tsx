"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const SPECIALTIES = [
  "Residential",
  "Commercial",
  "Luxury",
  "Investment",
  "First-Time Buyers",
  "Relocation",
  "New Construction",
  "Short Sales",
] as const;

type Specialty = (typeof SPECIALTIES)[number];

interface FormData {
  displayName: string;
  phone: string;
  email: string;
  bio: string;
  licenseNum: string;
  yearsExp: string;
  specialties: Specialty[];
  instagramUrl: string;
  facebookUrl: string;
  linkedinUrl: string;
}

const STEPS = ["Personal Info", "License", "Social", "Review"] as const;
type Step = 0 | 1 | 2 | 3;

export default function AgentOnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [step, setStep] = useState<Step>(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    displayName: "",
    phone: "",
    email: "",
    bio: "",
    licenseNum: "",
    yearsExp: "",
    specialties: [],
    instagramUrl: "",
    facebookUrl: "",
    linkedinUrl: "",
  });

  // Pre-fill email from session
  useEffect(() => {
    if (session?.user?.email) {
      setForm((prev) => ({ ...prev, email: prev.email || session.user!.email! }));
    }
    if (session?.user?.name) {
      setForm((prev) => ({ ...prev, displayName: prev.displayName || session.user!.name! }));
    }
  }, [session]);

  // Redirect if unauthenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2F0EF]">
        <p className="text-[#1B1B1B]/60">Loading…</p>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  const set = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleSpecialty = (s: Specialty) => {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(s)
        ? prev.specialties.filter((x) => x !== s)
        : [...prev.specialties, s],
    }));
  };

  const handleNext = () => {
    setError(null);
    if (step === 0 && !form.displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    setStep((prev) => Math.min(3, prev + 1) as Step);
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => Math.max(0, prev - 1) as Step);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/agent-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          yearsExp: form.yearsExp ? parseInt(form.yearsExp, 10) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2F0EF]">
        <div className="rounded-2xl bg-white px-10 py-12 text-center shadow-sm max-w-sm w-full mx-4">
          <p className="text-xl font-light text-[#1B1B1B]">Profile created!</p>
          <p className="mt-2 text-[#1B1B1B]/60 text-sm">Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-3 text-sm text-[#1B1B1B] placeholder-[#1B1B1B]/40 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/40";

  const labelClass = "mb-1 block text-xs font-medium text-[#1B1B1B]/60 uppercase tracking-wide";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F2F0EF] px-4 py-16">
      <div className="w-full max-w-lg rounded-2xl bg-white px-8 py-10 shadow-sm">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            {STEPS.map((label, i) => (
              <div key={label} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    i < step
                      ? "bg-[#9E8C61] text-white"
                      : i === step
                        ? "border-2 border-[#9E8C61] text-[#9E8C61]"
                        : "border border-[#1B1B1B]/20 text-[#1B1B1B]/30"
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </div>
                <span
                  className={`mt-1 text-[10px] ${
                    i === step ? "text-[#9E8C61]" : "text-[#1B1B1B]/40"
                  }`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[#F2F0EF]">
            <div
              className="h-full rounded-full bg-[#9E8C61] transition-all duration-300"
              style={{ width: `${((step) / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Step heading */}
        <h1 className="mb-6 font-sans text-2xl font-light text-[#1B1B1B]">{STEPS[step]}</h1>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {/* Step 1 — Personal Info */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className={labelClass}>Display Name *</label>
              <input
                className={inputClass}
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input
                className={inputClass}
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                className={inputClass}
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className={labelClass}>Bio</label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={4}
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                placeholder="Tell clients a bit about yourself…"
              />
            </div>
          </div>
        )}

        {/* Step 2 — License */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className={labelClass}>CA License Number</label>
              <input
                className={inputClass}
                value={form.licenseNum}
                onChange={(e) => set("licenseNum", e.target.value)}
                placeholder="e.g. 01234567"
              />
            </div>
            <div>
              <label className={labelClass}>Years of Experience</label>
              <input
                className={inputClass}
                type="number"
                min={0}
                value={form.yearsExp}
                onChange={(e) => set("yearsExp", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass}>Specialties</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SPECIALTIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpecialty(s)}
                    className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                      form.specialties.includes(s)
                        ? "bg-[#9E8C61] text-white"
                        : "border border-[#1B1B1B]/15 bg-[#F2F0EF] text-[#1B1B1B]/70 hover:border-[#9E8C61]/50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Social */}
        {step === 2 && (
          <div className="space-y-5">
            <p className="text-sm text-[#1B1B1B]/50">All social links are optional.</p>
            <div>
              <label className={labelClass}>Instagram URL</label>
              <input
                className={inputClass}
                type="url"
                value={form.instagramUrl}
                onChange={(e) => set("instagramUrl", e.target.value)}
                placeholder="https://instagram.com/username"
              />
            </div>
            <div>
              <label className={labelClass}>Facebook URL</label>
              <input
                className={inputClass}
                type="url"
                value={form.facebookUrl}
                onChange={(e) => set("facebookUrl", e.target.value)}
                placeholder="https://facebook.com/username"
              />
            </div>
            <div>
              <label className={labelClass}>LinkedIn URL</label>
              <input
                className={inputClass}
                type="url"
                value={form.linkedinUrl}
                onChange={(e) => set("linkedinUrl", e.target.value)}
                placeholder="https://linkedin.com/in/username"
              />
            </div>
          </div>
        )}

        {/* Step 4 — Review */}
        {step === 3 && (
          <div className="space-y-4 text-sm text-[#1B1B1B]">
            <div className="rounded-xl bg-[#F2F0EF] px-5 py-4 space-y-3">
              <Row label="Name" value={form.displayName} />
              <Row label="Phone" value={form.phone || "—"} />
              <Row label="Email" value={form.email} />
              <Row label="Bio" value={form.bio || "—"} />
            </div>
            <div className="rounded-xl bg-[#F2F0EF] px-5 py-4 space-y-3">
              <Row label="License #" value={form.licenseNum || "—"} />
              <Row label="Years Exp." value={form.yearsExp || "—"} />
              <Row
                label="Specialties"
                value={form.specialties.length > 0 ? form.specialties.join(", ") : "—"}
              />
            </div>
            <div className="rounded-xl bg-[#F2F0EF] px-5 py-4 space-y-3">
              <Row label="Instagram" value={form.instagramUrl || "—"} />
              <Row label="Facebook" value={form.facebookUrl || "—"} />
              <Row label="LinkedIn" value={form.linkedinUrl || "—"} />
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className={`mt-8 flex ${step > 0 ? "justify-between" : "justify-end"}`}>
          {step > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="rounded-full border border-[#1B1B1B]/15 px-6 py-2.5 text-sm text-[#1B1B1B]/60 hover:border-[#1B1B1B]/30 transition-colors"
            >
              ← Back
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="rounded-full bg-[#1B1B1B] px-8 py-2.5 text-sm text-white hover:bg-[#1B1B1B]/85 transition-colors"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-full bg-[#9E8C61] px-8 py-2.5 text-sm text-white hover:bg-[#8a7a52] transition-colors disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-24 shrink-0 text-[#1B1B1B]/50">{label}</span>
      <span className="text-[#1B1B1B]/80 break-all">{value}</span>
    </div>
  );
}
