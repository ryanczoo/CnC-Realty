"use client";
import { emailError } from "@/lib/form-validation";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { ROLE_OPTIONS } from "@/lib/role-options";
import { ContactConsentNotice } from "@/components/ui/ContactConsentNotice";
import { ModalShell } from "@/components/ui/ModalShell";
import { UnderlineField } from "@/components/ui/UnderlineField";
import { RoleSelect } from "@/components/ui/RoleSelect";

export { ROLE_OPTIONS };

interface ContactModalProps {
  open: boolean;
  source: string;
  onClose: () => void;
}

export function ContactModal({ open, source, onClose }: ContactModalProps) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", role: "", notes: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [roleError, setRoleError] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ firstName: "", lastName: "", email: "", role: "", notes: "" });
      setStatus("idle");
      setRoleError(false);
    }
  }, [open]);

  useEffect(() => {
    if (status !== "success") return;
    const t = setTimeout(onClose, 2000);
    return () => clearTimeout(t);
  }, [status, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.role) { setRoleError(true); return; }
    setStatus("loading");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "WEBSITE", utmSource: source, newsletterConsent: true }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} label="Let's Chat">
      <h2 className="font-sans text-[2rem] font-light leading-tight text-[#1B1B1B] max-lg:text-[1.6rem]">
        Let&apos;s Chat
      </h2>
      <p className="mt-1 mb-8 font-sans text-sm text-[#1B1B1B]/50 max-lg:mb-4">
        We&apos;re super responsive!
      </p>

      {status === "success" ? (
        <div className="py-8 text-center">
          <p className="font-sans text-lg font-light text-[#1B1B1B]">Message received.</p>
          <p className="mt-2 font-sans text-sm text-[#1B1B1B]/50">We&apos;ll be in touch soon.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-lg:gap-3">
          {/* First + Last Name: side by side on phones; display:contents on desktop keeps the stacked layout. */}
          <div className="contents max-lg:grid max-lg:grid-cols-2 max-lg:gap-3">
            <UnderlineField
              className="flex flex-col gap-1.5 max-lg:min-w-0 max-lg:gap-1"
              label="First Name"
              autoFocus
              value={form.firstName}
              onChange={(v) => setForm((f) => ({ ...f, firstName: v }))}
            />
            <UnderlineField
              className="flex flex-col gap-1.5 max-lg:min-w-0 max-lg:gap-1"
              label="Last Name"
              value={form.lastName}
              onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
            />
          </div>

          <UnderlineField
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            error={emailError(form.email)}
          />

          <RoleSelect
            value={form.role}
            onChange={(role) => setForm((f) => ({ ...f, role }))}
            error={roleError}
            onOpen={() => setRoleError(false)}
          />

          <UnderlineField
            label="Message"
            multiline
            rows={4}
            placeholder="Type away..."
            value={form.notes}
            onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
          />

          {status === "error" && (
            <p className="font-sans text-sm text-red-500">Something went wrong. Please try again.</p>
          )}

          <ContactConsentNotice />

          <motion.button
            type="submit"
            disabled={status === "loading" || !!emailError(form.email)}
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={{ scale: 1.02, transition: SPRING_HOVER }}
            className="w-full rounded-full bg-[#1B1B1B] py-3.5 font-sans text-sm font-medium text-white disabled:opacity-40 max-lg:py-3"
          >
            {status === "loading" ? "Sending…" : "Send Message"}
          </motion.button>
        </form>
      )}
    </ModalShell>
  );
}
