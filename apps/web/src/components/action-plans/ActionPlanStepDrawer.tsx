"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

type PlanStep = {
  id: string;
  stepOrder: number;
  delayDays: number;
  stepType: "EMAIL" | "TASK";
  subject: string | null;
  body: string | null;
  taskTitle: string | null;
};

type Props = {
  open: boolean;
  planId: string;
  step: PlanStep | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
};

export function ActionPlanStepDrawer({ open, planId, step, onClose, onSaved, onDeleted }: Props) {
  const [stepOrder, setStepOrder] = useState(1);
  const [delayDays, setDelayDays] = useState(0);
  const [stepType, setStepType] = useState<"EMAIL" | "TASK">("EMAIL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step) {
      setStepOrder(step.stepOrder);
      setDelayDays(step.delayDays);
      setStepType(step.stepType);
      setSubject(step.subject ?? "");
      setBody(step.body ?? "");
      setTaskTitle(step.taskTitle ?? "");
      setError(null);
    } else {
      setStepOrder(1);
      setDelayDays(0);
      setStepType("EMAIL");
      setSubject("");
      setBody("");
      setTaskTitle("");
      setError(null);
    }
  }, [step]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = { stepOrder, delayDays, stepType, subject: subject || null, body: body || null, taskTitle: taskTitle || null };
      const url = step
        ? `/api/admin/action-plans/${planId}/steps/${step.id}`
        : `/api/admin/action-plans/${planId}/steps`;
      const res = await fetch(url, {
        method: step ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Failed to save");
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

  async function handleDelete() {
    if (!step) return;
    if (!window.confirm("Delete this step?")) return;
    try {
      await fetch(`/api/admin/action-plans/${planId}/steps/${step.id}`, { method: "DELETE" });
      onDeleted();
      onClose();
    } catch {
      setError("Network error — please try again");
    }
  }

  const HINTS = "Available variables: {{first_name}}, {{last_name}}, {{agent_name}}, {{agent_phone}}";

  return (
    <div className={open ? "" : "hidden"} role="dialog" aria-modal="true" aria-label={step ? "Edit Step" : "Add Step"}>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/10 px-6 py-4">
          <h2 className="font-sans text-lg font-light text-[#1B1B1B]">{step ? "Edit Step" : "Add Step"}</h2>
          <button onClick={onClose} className="text-[#1B1B1B]/40 hover:text-[#1B1B1B]" aria-label="Close">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-[#1B1B1B]/50">Step Order</label>
              <input type="number" min={1} value={stepOrder} onChange={(e) => setStepOrder(Number(e.target.value))}
                className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-[#1B1B1B]/50">Delay (days from enrollment)</label>
              <input type="number" min={0} value={delayDays} onChange={(e) => setDelayDays(Number(e.target.value))}
                className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Step Type</label>
            <select value={stepType} onChange={(e) => setStepType(e.target.value as "EMAIL" | "TASK")}
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm">
              <option value="EMAIL">Email</option>
              <option value="TASK">Task</option>
            </select>
          </div>
          {stepType === "EMAIL" && (
            <>
              <div>
                <label className="mb-1 block text-xs text-[#1B1B1B]/50">Subject *</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
                  placeholder="e.g. Hi {{first_name}}, welcome to CnC!" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#1B1B1B]/50">Body *</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6}
                  className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61] resize-none"
                  placeholder={`Email body...\n\n${HINTS}`} />
                <p className="mt-1 text-xs text-[#1B1B1B]/40">{HINTS}</p>
              </div>
            </>
          )}
          {stepType === "TASK" && (
            <div>
              <label className="mb-1 block text-xs text-[#1B1B1B]/50">Task Title *</label>
              <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}
                className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
                placeholder="e.g. Call {{first_name}} to check in" />
              <p className="mt-1 text-xs text-[#1B1B1B]/40">{HINTS}</p>
            </div>
          )}
        </div>
        <div className="border-t border-[#1B1B1B]/10 px-6 py-4 flex items-center gap-2">
          {step && (
            <button onClick={handleDelete} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-500 hover:bg-red-50">Delete</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="rounded-lg border border-[#1B1B1B]/10 px-4 py-2 text-sm">Cancel</button>
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
