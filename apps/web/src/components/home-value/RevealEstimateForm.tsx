"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { formatPhoneInput, isValidEmail } from "@/lib/form-validation";

interface Props {
  address: string;
  zip: string;
  beds: number | null;
  sqft: number;
}

export function RevealEstimateForm({ address, zip, beds, sqft }: Props) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pointEstimate, setPointEstimate] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
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
      setOpen(false);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (pointEstimate != null) {
    return (
      <div className="mt-6 border-t border-[#1B1B1B]/10 pt-6 text-center">
        <p className="text-sm text-[#1B1B1B]/50">Estimated Home Value</p>
        <p className="mt-2 text-4xl font-bold text-[#1B1B1B]">
          ${pointEstimate.toLocaleString()}
        </p>
        <p className="mt-8 text-sm text-[#1B1B1B]/60">
          Based off MLS data and actual transactions within your area
        </p>
      </div>
    );
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        animate={PULSE_ANIMATE}
        transition={PULSE_TRANSITION}
        whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
        className="mt-16 self-center rounded-full bg-[#1B1B1B] px-8 py-3.5 font-sans text-sm font-medium text-white"
      >
        Reveal Exact Estimate
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-2xl bg-white p-10"
            >
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute right-6 top-6 text-[#1B1B1B]/40 transition-colors hover:text-[#1B1B1B]"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              <h2 className="font-sans text-[2rem] font-light leading-tight text-[#1B1B1B]">
                Get Your Exact Estimate
              </h2>
              <p className="mt-1 mb-8 font-sans text-sm text-[#1B1B1B]/50">
                Enter your info to reveal your home&apos;s precise estimated value.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-left font-sans text-sm text-[#1B1B1B]/60">First Name *</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-left font-sans text-sm text-[#1B1B1B]/60">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-left font-sans text-sm text-[#1B1B1B]/60">Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-left font-sans text-sm text-[#1B1B1B]/60">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                    className="border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
                  />
                </div>

                {error && <p className="font-sans text-sm text-red-500">{error}</p>}

                <motion.button
                  type="submit"
                  disabled={loading}
                  animate={PULSE_ANIMATE}
                  transition={PULSE_TRANSITION}
                  whileHover={{ scale: 1.02, transition: SPRING_HOVER }}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1B1B1B] py-3.5 font-sans text-sm font-medium text-white disabled:opacity-40"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Getting your estimate…" : "Reveal Exact Estimate"}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
