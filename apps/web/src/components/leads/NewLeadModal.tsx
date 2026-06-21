"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

const SOURCE_OPTIONS = [
  { value: "OTHER", label: "Other" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WEBSITE", label: "Website" },
  { value: "SOCIAL", label: "Social Media" },
  { value: "OPEN_HOUSE", label: "Open House" },
  { value: "COLD_CALL", label: "Cold Call" },
] as const;

type SavedLead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: (lead: SavedLead) => void;
}

const INPUT_CLS =
  "w-full rounded-lg border border-[#1B1B1B]/15 bg-[#F2F0EF] px-4 py-2.5 text-sm text-[#1B1B1B] focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/40";

export function NewLeadModal({ open, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    source: "OTHER" as string,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function reset() {
    setForm({ firstName: "", lastName: "", email: "", phone: "", source: "OTHER", notes: "" });
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          source: form.source,
          notes: form.notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError((json as { error?: string }).error ?? "Failed to save lead.");
        return;
      }
      onSaved?.({
        id: (json as { id: string }).id,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        status: "NEW",
        createdAt: new Date().toISOString(),
      });
      reset();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) { reset(); onClose(); } }}
        >
          <motion.div
            className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <h2 className="mb-6 font-sans text-xl font-light text-[#1B1B1B]">Add Lead</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-[#1B1B1B]/50">First Name *</label>
                  <input required className={INPUT_CLS} value={form.firstName} onChange={set("firstName")} placeholder="Jane" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#1B1B1B]/50">Last Name *</label>
                  <input required className={INPUT_CLS} value={form.lastName} onChange={set("lastName")} placeholder="Smith" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#1B1B1B]/50">Email *</label>
                <input required type="email" className={INPUT_CLS} value={form.email} onChange={set("email")} placeholder="jane@example.com" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#1B1B1B]/50">Phone</label>
                <input type="tel" className={INPUT_CLS} value={form.phone} onChange={set("phone")} placeholder="(555) 000-0000" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#1B1B1B]/50">Source</label>
                <select className={INPUT_CLS} value={form.source} onChange={set("source")}>
                  {SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#1B1B1B]/50">Notes</label>
                <textarea rows={3} className={INPUT_CLS} value={form.notes} onChange={set("notes")} placeholder="How did you meet this lead?" />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <motion.button
                  type="button"
                  onClick={() => { reset(); onClose(); }}
                  className="rounded-full border border-[#1B1B1B]/20 px-5 py-2 text-sm text-[#1B1B1B]/60 hover:text-[#1B1B1B]"
                  whileHover={{ scale: 1.04, transition: SPRING_HOVER }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-[#9E8C61] px-6 py-2 text-sm text-white disabled:opacity-50"
                  animate={saving ? {} : { scale: [1, 1.04, 1] }}
                  transition={saving ? {} : PULSE_TRANSITION}
                  whileHover={saving ? {} : { scale: 1.05, transition: SPRING_HOVER }}
                >
                  {saving ? "Saving…" : "Add Lead"}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
