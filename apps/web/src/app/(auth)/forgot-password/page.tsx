"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-2 text-2xl font-bold" style={{ color: "var(--brand-navy)" }}>
          Reset Password
        </h1>

        {submitted ? (
          <div className="mt-4 rounded bg-green-50 px-4 py-3 text-sm text-green-700">
            If an account exists for that email, you&apos;ll receive a reset link shortly.
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-gray-500">
              Enter your email and we&apos;ll send a reset link.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-navy)]"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                style={{ backgroundColor: "var(--brand-navy)", color: "white" }}
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/login" className="font-medium text-[var(--brand-navy)] hover:underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
