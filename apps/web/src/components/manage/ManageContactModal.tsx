"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useClickOutside } from "@/hooks/useClickOutside";
import {
  NAV_PANEL_CLS,
  NAV_ITEM_CLS,
  PULSE_ANIMATE,
  PULSE_TRANSITION,
  SPRING_HOVER,
} from "@/lib/motion";

const ROLE_OPTIONS = [
  "Home Buyer",
  "Home Seller",
  "Home Owner",
  "Renter",
  "Landlord",
  "Property Manager",
];

interface ManageContactModalProps {
  open: boolean;
  cardTitle: string;
  onClose: () => void;
}

export function ManageContactModal({ open, cardTitle, onClose }: ManageContactModalProps) {
  const [form, setForm] = useState({ firstName: "", email: "", role: "", notes: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleError, setRoleError] = useState(false);

  const roleRef = useRef<HTMLDivElement>(null);

  useClickOutside(roleRef, () => setRoleOpen(false));

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm({ firstName: "", email: "", role: "", notes: "" });
      setStatus("idle");
      setRoleError(false);
    }
  }, [open]);

  // Auto-close after success
  useEffect(() => {
    if (status !== "success") return;
    const t = setTimeout(onClose, 2000);
    return () => clearTimeout(t);
  }, [status, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.role) { setRoleError(true); return; }
    setStatus("loading");
    const source = "MANAGE_" + cardTitle.toUpperCase().replace(/\s+/g, "_");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-2xl bg-white p-10"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-6 top-6 text-[#1B1B1B]/40 transition-colors hover:text-[#1B1B1B]"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            <h2 className="font-sans text-[2rem] font-light leading-tight text-[#1B1B1B]">
              Let&apos;s Chat
            </h2>
            <p className="mt-1 mb-8 font-sans text-sm text-[#1B1B1B]/50">
              We&apos;re super responsive!
            </p>

            {status === "success" ? (
              <div className="py-8 text-center">
                <p className="font-sans text-lg font-light text-[#1B1B1B]">Message received.</p>
                <p className="mt-2 font-sans text-sm text-[#1B1B1B]/50">We&apos;ll be in touch soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                {/* First Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-sans text-sm text-[#1B1B1B]/60">First Name *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
                    placeholder="First name"
                  />
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-sans text-sm text-[#1B1B1B]/60">Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
                    placeholder="your@email.com"
                  />
                </div>

                {/* I am a */}
                <div className="flex flex-col gap-1.5" ref={roleRef}>
                  <label className={`font-sans text-sm ${roleError ? "text-red-500" : "text-[#1B1B1B]/60"}`}>
                    I am a *
                  </label>
                  <button
                    type="button"
                    onClick={() => { setRoleOpen((o) => !o); setRoleError(false); }}
                    className="flex items-center justify-between border-b py-2 font-sans text-base transition-colors focus:outline-none"
                    style={{ borderColor: roleError ? "rgb(239,68,68)" : roleOpen ? "rgba(27,27,27,0.6)" : "rgba(27,27,27,0.2)" }}
                  >
                    <span className={form.role ? "text-[#1B1B1B]" : "text-[#1B1B1B]/30"}>
                      {form.role || "Select one…"}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                      className={`transition-transform duration-200 ${roleOpen ? "rotate-180" : ""}`}>
                      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#1B1B1B]/40" />
                    </svg>
                  </button>
                  {roleOpen && (
                    <div className="relative z-50">
                      <div className={`absolute left-0 top-1 w-52 ${NAV_PANEL_CLS}`}>
                        {ROLE_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => { setForm((f) => ({ ...f, role: opt })); setRoleOpen(false); }}
                            className={`${NAV_ITEM_CLS} ${form.role === opt ? "text-[#c9a84c]" : "text-white/80"}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Message */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-sans text-sm text-[#1B1B1B]/60">Message *</label>
                  <textarea
                    rows={4}
                    required
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="resize-none border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
                    placeholder="Tell us what you're looking for…"
                  />
                </div>

                {status === "error" && (
                  <p className="font-sans text-sm text-red-500">Something went wrong. Please try again.</p>
                )}

                <motion.button
                  type="submit"
                  disabled={status === "loading"}
                  animate={PULSE_ANIMATE}
                  transition={PULSE_TRANSITION}
                  whileHover={{ scale: 1.02, transition: SPRING_HOVER }}
                  className="w-full rounded-full bg-[#1B1B1B] py-3.5 font-sans text-sm font-medium text-white disabled:opacity-40"
                >
                  {status === "loading" ? "Sending…" : "Send Message"}
                </motion.button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
