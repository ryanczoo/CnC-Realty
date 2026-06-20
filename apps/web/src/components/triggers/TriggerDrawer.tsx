"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

type Plan = { id: string; name: string; isActive: boolean };

type TriggerRow = {
  id: string;
  name: string;
  statusTrigger: string;
  actionType: "ENROLL_PLAN" | "SEND_EMAIL";
  actionPlanId: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  isActive: boolean;
};

type Props = {
  open: boolean;
  trigger: TriggerRow | null;
  onClose: () => void;
  onSaved: () => void;
};

const ALL_STATUSES = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "HOT_PROSPECT", label: "Hot Prospect" },
  { value: "NURTURE", label: "Nurture" },
  { value: "SHOWING", label: "Showing" },
  { value: "OFFER", label: "Offer" },
  { value: "UNDER_CONTRACT", label: "Under Contract" },
  { value: "CLOSED", label: "Closed" },
  { value: "LOST", label: "Lost" },
  { value: "SPHERE", label: "Sphere of Influence" },
];

export function TriggerDrawer({ open, trigger, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [statusTrigger, setStatusTrigger] = useState("NEW");
  const [actionType, setActionType] = useState<"ENROLL_PLAN" | "SEND_EMAIL">("ENROLL_PLAN");
  const [actionPlanId, setActionPlanId] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/action-plans")
      .then((r) => r.json())
      .then((data: Plan[]) => setPlans(data.filter((p) => p.isActive)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (trigger) {
      setName(trigger.name);
      setStatusTrigger(trigger.statusTrigger);
      setActionType(trigger.actionType);
      setActionPlanId(trigger.actionPlanId ?? "");
      setEmailSubject(trigger.emailSubject ?? "");
      setEmailBody(trigger.emailBody ?? "");
      setIsActive(trigger.isActive);
    } else {
      setName("");
      setStatusTrigger("NEW");
      setActionType("ENROLL_PLAN");
      setActionPlanId("");
      setEmailSubject("");
      setEmailBody("");
      setIsActive(true);
    }
    setError(null);
  }, [trigger, open]);

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    if (actionType === "ENROLL_PLAN" && !actionPlanId) { setError("Please select an action plan"); return; }
    if (actionType === "SEND_EMAIL" && !emailSubject.trim()) { setError("Email subject is required"); return; }
    if (actionType === "SEND_EMAIL" && !emailBody.trim()) { setError("Email body is required"); return; }

    setSaving(true);
    setError(null);
    try {
      const isEdit = !!trigger;
      const res = await fetch(
        isEdit ? `/api/admin/triggers/${trigger!.id}` : "/api/admin/triggers",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            statusTrigger,
            actionType,
            actionPlanId: actionType === "ENROLL_PLAN" ? actionPlanId : null,
            emailSubject: actionType === "SEND_EMAIL" ? emailSubject.trim() : null,
            emailBody: actionType === "SEND_EMAIL" ? emailBody.trim() : null,
            isActive,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Failed to save");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={open ? "" : "hidden"} role="dialog" aria-modal="true" aria-label={trigger ? "Edit Trigger" : "New Trigger"}>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/10 px-6 py-4">
          <h2 className="font-sans text-lg font-light text-[#1B1B1B]">
            {trigger ? "Edit Trigger" : "New Trigger"}
          </h2>
          <button onClick={onClose} className="text-[#1B1B1B]/40 hover:text-[#1B1B1B]" aria-label="Close">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          {/* Name */}
          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Trigger Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
              placeholder="e.g. Auto-qualify drip"
            />
          </div>

          {/* Status trigger */}
          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">When status changes to *</label>
            <select
              value={statusTrigger}
              onChange={(e) => setStatusTrigger(e.target.value)}
              className="w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
            >
              {ALL_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Action type pills */}
          <div>
            <label className="mb-2 block text-xs text-[#1B1B1B]/50">Action *</label>
            <div className="flex gap-2">
              {(["ENROLL_PLAN", "SEND_EMAIL"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActionType(type)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    actionType === type
                      ? "border-[#9E8C61] bg-[#9E8C61]/10 text-[#9E8C61]"
                      : "border-[#1B1B1B]/10 text-[#1B1B1B]/50 hover:border-[#1B1B1B]/20"
                  }`}
                >
                  {type === "ENROLL_PLAN" ? "Enroll in Plan" : "Send Email"}
                </button>
              ))}
            </div>
          </div>

          {/* ENROLL_PLAN fields — always mounted, CSS hidden */}
          <div className={actionType === "ENROLL_PLAN" ? "" : "hidden"}>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Action Plan *</label>
            <select
              value={actionPlanId}
              onChange={(e) => setActionPlanId(e.target.value)}
              className="w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
            >
              <option value="">— Select a plan —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* SEND_EMAIL fields — always mounted, CSS hidden */}
          <div className={actionType === "SEND_EMAIL" ? "" : "hidden"}>
            <div className="mb-3">
              <label className="mb-1 block text-xs text-[#1B1B1B]/50">Email Subject *</label>
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
                placeholder="e.g. Your offer was accepted!"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#1B1B1B]/50">Email Body *</label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={5}
                className="w-full resize-none rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
                placeholder="Write the email message to send to the lead..."
              />
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <input
              id="trigger-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-[#9E8C61]"
            />
            <label htmlFor="trigger-active" className="text-sm text-[#1B1B1B]">Active</label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#1B1B1B]/10 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#1B1B1B]/10 px-4 py-2 text-sm text-[#1B1B1B]/50 hover:bg-[#F2F0EF]"
          >
            Cancel
          </button>
          <motion.button
            onClick={handleSave}
            disabled={saving}
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
