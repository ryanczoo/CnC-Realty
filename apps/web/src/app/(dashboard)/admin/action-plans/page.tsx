"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { ActionPlanDrawer } from "@/components/action-plans/ActionPlanDrawer";
import { ActionPlanDetailDrawer } from "@/components/action-plans/ActionPlanDetailDrawer";

type Plan = { id: string; name: string; description: string | null; isActive: boolean; stepCount: number; createdAt: string };

export const dynamic = "force-dynamic";

export default function ActionPlansAdminPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newDrawerOpen, setNewDrawerOpen] = useState(false);
  const [detailPlan, setDetailPlan] = useState<Plan | null>(null);

  function loadPlans() {
    setLoading(true);
    fetch("/api/admin/action-plans")
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => setError("Failed to load plans"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadPlans(); }, []);

  async function handleDeletePlan(planId: string) {
    if (!window.confirm("Delete this plan? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/action-plans/${planId}`, { method: "DELETE" });
    if (res.status === 409) {
      alert("Cannot delete plan with active enrollments.");
      return;
    }
    setDetailPlan(null);
    loadPlans();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Action Plans</h1>
          <p className="mt-1 text-sm text-[#1B1B1B]/40">Create and manage automated drip sequences for agents to apply to leads</p>
        </div>
        <motion.button
          onClick={() => setNewDrawerOpen(true)}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          className="rounded-full bg-[#1B1B1B] px-5 py-2.5 text-sm font-medium text-white"
        >
          + New Plan
        </motion.button>
      </div>

      {loading && <Loader2 className="h-6 w-6 animate-spin text-[#9E8C61]" />}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && plans.length === 0 && (
        <p className="text-center text-sm text-[#1B1B1B]/40 py-12">No action plans yet. Create one above.</p>
      )}

      <div className="space-y-2">
        {plans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setDetailPlan(plan)}
            className="w-full text-left rounded-lg bg-[#F2F0EF] px-5 py-4 hover:bg-[#F2F0EF]/70 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${plan.isActive ? "bg-green-100 text-green-700" : "bg-[#1B1B1B]/10 text-[#1B1B1B]/50"}`}>
                  {plan.isActive ? "Active" : "Inactive"}
                </span>
                <h3 className="text-sm font-medium text-[#1B1B1B]">{plan.name}</h3>
              </div>
              <span className="text-xs text-[#1B1B1B]/40">{plan.stepCount} step{plan.stepCount !== 1 ? "s" : ""}</span>
            </div>
            {plan.description && <p className="mt-1 text-xs text-[#1B1B1B]/50 truncate">{plan.description}</p>}
          </button>
        ))}
      </div>

      <ActionPlanDrawer
        open={newDrawerOpen}
        plan={null}
        onClose={() => setNewDrawerOpen(false)}
        onSaved={() => { setNewDrawerOpen(false); loadPlans(); }}
      />

      <ActionPlanDetailDrawer
        open={!!detailPlan}
        plan={detailPlan}
        onClose={() => setDetailPlan(null)}
        onPlanChanged={loadPlans}
        onDeletePlan={handleDeletePlan}
      />
    </div>
  );
}
