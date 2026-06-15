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
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // intentionally silent — always show generic message to avoid email enumeration
    }
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#1B1B1B] px-4">
      <div className="w-full max-w-md rounded-xl bg-[#F2F0EF] p-8 shadow-md">
        <h1 className="mb-2 text-2xl font-bold text-[#1B1B1B]">
          Reset Password
        </h1>

        {submitted ? (
          <div className="mt-4 rounded bg-[#1B1B1B]/8 px-4 py-3 text-sm text-[#1B1B1B]/70">
            If an account exists for that email, you&apos;ll receive a reset link shortly.
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-[#1B1B1B]/60">
              Enter your email and we&apos;ll send a reset link.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#1B1B1B]/70">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full rounded-md border border-[#1B1B1B]/20 bg-transparent px-3 py-2 text-sm text-[#1B1B1B] focus:border-[#1B1B1B]/60 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/40"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                style={{ backgroundColor: "#9E8C61", color: "white" }}
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-[#1B1B1B]/60">
          <Link href="/login" className="font-medium text-[#9E8C61] hover:underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
