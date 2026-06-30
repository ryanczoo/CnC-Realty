"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-3 text-sm text-[#1B1B1B] focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/40";

function SetupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (!token) { setError("Invalid setup link."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/setup-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <p className="text-center text-sm text-red-500">
        Invalid setup link. Please contact{" "}
        <a href="mailto:info@cncrealtygroup.com" className="underline">info@cncrealtygroup.com</a>.
      </p>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <p className="font-sans text-xl font-light text-[#1B1B1B]">Password set!</p>
        <p className="mt-2 text-sm text-[#1B1B1B]/60">Redirecting to login…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-5">
      <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Set your password</h1>
      <p className="text-sm text-[#1B1B1B]/50">Choose a password for your CnC Realty account.</p>
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/60 text-left">Password</label>
        <input
          className={inputClass}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/60 text-left">Confirm Password</label>
        <input
          className={inputClass}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-full bg-[#9E8C61] py-3 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8a7a52] disabled:opacity-60"
      >
        {submitting ? "Setting password…" : "Set Password & Continue"}
      </button>
    </div>
  );
}

export default function SetupAccountPage() {
  return (
    <main data-navbar-theme="light" className="flex min-h-screen items-center justify-center bg-[#F2F0EF] px-4">
      <Suspense fallback={<p className="text-sm text-[#1B1B1B]/40">Loading…</p>}>
        <SetupForm />
      </Suspense>
    </main>
  );
}
