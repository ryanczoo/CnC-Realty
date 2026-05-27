"use client";
import { useCallback, useRef, useState } from "react";
import { motion } from "motion/react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { NAV_PANEL_CLS, NAV_ITEM_CLS, SPRING_HOVER } from "@/lib/motion";

const ROLE_OPTIONS = [
  "Home Buyer",
  "Home Seller",
  "Home Owner",
  "Renter",
  "Landlord",
  "Property Manager",
];

export default function ContactPage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", role: "", notes: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [roleOpen, setRoleOpen] = useState(false);
  const roleRef = useRef<HTMLDivElement>(null);

  useClickOutside(roleRef, useCallback(() => setRoleOpen(false), []));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "WEBSITE" }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      setForm({ firstName: "", lastName: "", email: "", phone: "", role: "", notes: "" });
    } catch {
      setStatus("error");
    }
  }

  const field = (name: keyof typeof form, label: string, type = "text", required = false) => (
    <div className="flex flex-col gap-1.5">
      <label className="font-sans text-sm text-[#1B1B1B]/60">{label}{required && " *"}</label>
      <input
        type={type}
        required={required}
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        className="border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
      />
    </div>
  );

  return (
    <main data-navbar-theme="light" className="min-h-screen bg-[#F2F0EF] px-8 pb-24 pt-32 lg:px-20">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-2 font-sans text-[3rem] font-light leading-tight text-[#1B1B1B]">
          Let's chat
        </h1>
        <p className="mb-12 font-sans text-base text-[#1B1B1B]/50">
          We're super responsive!
        </p>

        {status === "success" ? (
          <div className="rounded-2xl bg-cnc-bg p-8 text-center">
            <p className="font-sans text-lg font-light text-[#1B1B1B]">Message received.</p>
            <p className="mt-2 font-sans text-sm text-[#1B1B1B]/50">We&apos;ll be in touch soon.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            <div className="grid grid-cols-2 gap-6">
              {field("firstName", "First Name", "text", true)}
              {field("lastName", "Last Name", "text", true)}
            </div>
            {field("email", "Email", "email", true)}
            {field("phone", "Phone (optional)")}

            <div className="flex flex-col gap-1.5" ref={roleRef}>
              <label className="font-sans text-sm text-[#1B1B1B]/60">I am a</label>
              <button
                type="button"
                onClick={() => setRoleOpen((o) => !o)}
                className="flex items-center justify-between border-b border-[#1B1B1B]/20 py-2 font-sans text-base transition-colors focus:outline-none"
                style={{ borderColor: roleOpen ? "rgba(27,27,27,0.6)" : undefined }}
              >
                <span className={form.role ? "text-[#1B1B1B]" : "text-[#1B1B1B]/30"}>
                  {form.role || "Select one…"}
                </span>
                <svg
                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                  className={`transition-transform duration-200 ${roleOpen ? "rotate-180" : ""}`}
                >
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

            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-sm text-[#1B1B1B]/60">Message *</label>
              <textarea
                rows={4}
                required
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="resize-none border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
              />
            </div>
            {status === "error" && (
              <p className="font-sans text-sm text-red-500">Something went wrong. Please try again.</p>
            )}
            <motion.button
              type="submit"
              disabled={status === "loading"}
              whileHover={{ scale: 1.15 }}
              transition={SPRING_HOVER}
              className="self-start rounded-full bg-[#1B1B1B] px-8 py-3.5 font-sans text-sm font-medium text-white disabled:opacity-40"
            >
              {status === "loading" ? "Sending…" : "Send Message"}
            </motion.button>
          </form>
        )}
      </div>
    </main>
  );
}
