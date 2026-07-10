"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { ActionPlanStepDrawer } from "./ActionPlanStepDrawer";

type PlanStep = {
  id: string;
  stepOrder: number;
  delayDays: number;
  stepType: "EMAIL" | "TASK";
  subject: string | null;
  body: string | null;
  taskTitle: string | null;
};

type ActionPlan = { id: string; name: string; description: string | null; isActive: boolean };

type Props = {
  open: boolean;
  plan: ActionPlan | null;
  onClose: () => void;
  onPlanChanged: () => void;
  onDeletePlan: (planId: string) => void;
};

export function ActionPlanDetailDrawer({ open, plan, onClose, onPlanChanged, onDeletePlan }: Props) {
  const [steps, setSteps] = useState<PlanStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepDrawerOpen, setStepDrawerOpen] = useState(false);
  const [editStep, setEditStep] = useState<PlanStep | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!plan || !open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/action-plans/${plan.id}/steps`)
      .then((r) => r.json())
      .then((data) => setSteps(Array.isArray(data) ? data.sort((a: PlanStep, b: PlanStep) => a.stepOrder - b.stepOrder) : []))
      .catch(() => setError("Failed to load steps"))
      .finally(() => setLoading(false));
  }, [plan, open]);

  async function toggleActive() {
    if (!plan) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/admin/action-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !plan.isActive }),
      });
      if (res.ok) onPlanChanged();
    } finally {
      setToggling(false);
    }
  }

  function reloadSteps() {
    if (!plan) return;
    fetch(`/api/admin/action-plans/${plan.id}/steps`)
      .then((r) => r.json())
      .then((data) => setSteps(Array.isArray(data) ? data.sort((a: PlanStep, b: PlanStep) => a.stepOrder - b.stepOrder) : []));
  }

  const DELAY_LABEL = (d: number) => d === 0 ? "Day 0 (immediately)" : `Day ${d}`;

  return (
    <>
      <div className={open ? "" : "hidden"} role="dialog" aria-modal="true" aria-label="Plan Details">
        <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
        <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#1B1B1B]/10 px-6 py-4">
            <div>
              <h2 className="font-sans text-lg font-light text-[#1B1B1B]">{plan?.name}</h2>
              {plan?.description && <p className="text-xs text-[#1B1B1B]/50 mt-0.5">{plan.description}</p>}
            </div>
            <button onClick={onClose} className="text-[#1B1B1B]/40 hover:text-[#1B1B1B]" aria-label="Close">✕</button>
          </div>

          <div className="flex items-center justify-between px-6 py-3 border-b border-[#1B1B1B]/10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#1B1B1B]/50">Active</span>
              <button
                onClick={toggleActive}
                disabled={toggling}
                className={`w-10 h-5 rounded-full transition-colors ${plan?.isActive ? "bg-[#9E8C61]" : "bg-[#1B1B1B]/20"}`}
              >
                <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${plan?.isActive ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            <motion.button
              onClick={() => { setEditStep(null); setStepDrawerOpen(true); }}
              className="rounded-lg bg-[#1B1B1B] px-3 py-1.5 text-xs font-medium text-white"
              animate={PULSE_ANIMATE}
              transition={PULSE_TRANSITION}
              whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            >
              + Add Step
            </motion.button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {error && <p className="text-sm text-red-500">{error}</p>}
            {loading && <Loader2 className="h-6 w-6 animate-spin text-[#9E8C61]" />}
            {!loading && steps.length === 0 && <p className="text-sm text-[#1B1B1B]/40">No steps yet. Add one above.</p>}
            {steps.map((s) => (
              <button
                key={s.id}
                onClick={() => { setEditStep(s); setStepDrawerOpen(true); }}
                className="w-full text-left rounded-lg bg-[#F2F0EF] px-4 py-3 hover:bg-[#F2F0EF]/70 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.stepType === "EMAIL" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                      {s.stepType}
                    </span>
                    <span className="text-xs text-[#1B1B1B]/50">{DELAY_LABEL(s.delayDays)}</span>
                  </div>
                  <span className="text-xs text-[#1B1B1B]/30">#{s.stepOrder}</span>
                </div>
                <p className="mt-1 text-sm text-[#1B1B1B] truncate">
                  {s.stepType === "EMAIL" ? s.subject : s.taskTitle}
                </p>
              </button>
            ))}
          </div>

          <div className="border-t border-[#1B1B1B]/10 px-6 py-4">
            <button
              onClick={() => plan && onDeletePlan(plan.id)}
              className="text-sm text-red-500 hover:underline"
            >
              Delete plan
            </button>
          </div>
        </div>
      </div>

      {plan && (
        <ActionPlanStepDrawer
          open={stepDrawerOpen}
          planId={plan.id}
          step={editStep}
          onClose={() => setStepDrawerOpen(false)}
          onSaved={reloadSteps}
          onDeleted={reloadSteps}
        />
      )}
    </>
  );
}
