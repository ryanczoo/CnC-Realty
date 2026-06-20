"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

type ActionPlan = { id: string; name: string; description: string | null };

type Props = {
  open: boolean;
  plan: ActionPlan | null;
  onClose: () => void;
  onSaved: (plan: ActionPlan) => void;
};

export function ActionPlanDrawer({ open, plan, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setDescription(plan.description ?? "");
      setError(null);
    } else {
      setName("");
      setDescription("");
      setError(null);
    }
  }, [plan]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const isEdit = !!plan;
      const res = await fetch(
        isEdit ? `/api/admin/action-plans/${plan!.id}` : "/api/admin/action-plans",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to save");
        return;
      }
      const saved = await res.json();
      onSaved(saved);
      onClose();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={open ? "" : "hidden"} role="dialog" aria-modal="true" aria-label={plan ? "Edit Plan" : "New Plan"}>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/10 px-6 py-4">
          <h2 className="font-sans text-lg font-light text-[#1B1B1B]">{plan ? "Edit Plan" : "New Plan"}</h2>
          <button onClick={onClose} className="text-[#1B1B1B]/40 hover:text-[#1B1B1B]" aria-label="Close">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Plan Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
              placeholder="e.g. New Lead 7-Day Drip"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61] resize-none"
              placeholder="Optional description"
            />
          </div>
        </div>
        <div className="border-t border-[#1B1B1B]/10 px-6 py-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[#1B1B1B]/10 px-4 py-2 text-sm">Cancel</button>
          <motion.button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            className="rounded-lg bg-[#1B1B1B] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
