"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

interface Props {
  address: string;
  zip: string;
  beds: number | null;
  sqft: number;
}

export function RevealEstimateForm({ address, zip, beds, sqft }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pointEstimate, setPointEstimate] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/home-value/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, phone, address, zip, beds, sqft }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Please try again.");
        return;
      }
      setPointEstimate(body.pointEstimate);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (pointEstimate != null) {
    return (
      <section className="rounded-xl border border-cnc-gold/30 bg-white py-10 text-center">
        <p className="text-sm text-[#1B1B1B]/50">Your Estimated Home Value</p>
        <p className="mt-2 text-4xl font-bold text-[#1B1B1B]">
          ${pointEstimate.toLocaleString()}
        </p>
        <p className="mt-4 text-sm text-[#1B1B1B]/60">
          A CnC agent will follow up shortly with a full comparative market analysis.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#1B1B1B]/10 bg-white p-8">
      <h3 className="text-xl font-medium text-[#1B1B1B]">Get Your Exact Estimate</h3>
      <p className="mt-1 text-sm text-[#1B1B1B]/50">
        Enter your info to reveal your home's precise estimated value.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          className="rounded-lg border border-[#1B1B1B]/15 bg-cnc-bg px-4 py-3 text-[#1B1B1B]"
          aria-label="First Name"
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
          className="rounded-lg border border-[#1B1B1B]/15 bg-cnc-bg px-4 py-3 text-[#1B1B1B]"
          aria-label="Last Name"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-[#1B1B1B]/15 bg-cnc-bg px-4 py-3 text-[#1B1B1B] sm:col-span-2"
          aria-label="Email"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          className="rounded-lg border border-[#1B1B1B]/15 bg-cnc-bg px-4 py-3 text-[#1B1B1B] sm:col-span-2"
          aria-label="Phone"
        />
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <motion.button
          type="submit"
          disabled={loading}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          className="rounded-full bg-[#1B1B1B] py-3 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2"
        >
          {loading ? "Getting your estimate…" : "Get My Exact Estimate"}
        </motion.button>
      </form>
    </section>
  );
}
