"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SPRING_HOVER } from "@/lib/motion";

type EnrollmentStep = {
  id: string;
  stepOrder: number;
  stepType: "EMAIL" | "TASK";
  subject: string | null;
  taskTitle: string | null;
  dueAt: string;
  status: "PENDING" | "DONE" | "SKIPPED" | "PAUSED";
  executedAt: string | null;
};

type Enrollment = {
  id: string;
  planId: string;
  planName: string;
  agentId: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  enrolledAt: string;
  pausedAt: string | null;
  pausedReason: string | null;
  completedAt: string | null;
  steps: EnrollmentStep[];
};

type ActivePlan = { id: string; name: string; stepCount: number };

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-[#1B1B1B]/10 text-[#1B1B1B]/50",
};

const STEP_STATUS_COLORS: Record<string, string> = {
  PENDING: "text-[#1B1B1B]/50",
  DONE: "text-green-600",
  SKIPPED: "text-[#1B1B1B]/30 line-through",
  PAUSED: "text-amber-600",
};

export function LeadActionPlansSection({ leadId }: { leadId: string }) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [activePlans, setActivePlans] = useState<ActivePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/leads/${leadId}/enrollments`, { signal: controller.signal }).then((r) => r.json()),
      fetch("/api/admin/action-plans", { signal: controller.signal }).then((r) => r.json()),
    ])
      .then(([enrs, plans]) => {
        setEnrollments(Array.isArray(enrs) ? enrs : []);
        setActivePlans(Array.isArray(plans) ? plans.filter((p: ActivePlan & { isActive: boolean }) => p.isActive) : []);
      })
      .catch((e: Error) => { if (e.name !== "AbortError") setError("Failed to load action plans"); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [leadId]);

  async function enroll(planId: string) {
    setEnrolling(true);
    setActionError(null);
    setShowPlanPicker(false);
    try {
      const res = await fetch(`/api/leads/${leadId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        setActionError(b.error ?? "Failed to enroll");
        return;
      }
      const enr = await res.json() as Enrollment;
      setEnrollments((prev) => [enr, ...prev]);
    } catch {
      setActionError("Network error — please try again");
    } finally {
      setEnrolling(false);
    }
  }

  async function updateEnrollment(enrollmentId: string, status: "PAUSED" | "ACTIVE" | "CANCELLED") {
    setActionError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/enrollments/${enrollmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        setActionError(b.error ?? "Failed to update");
        return;
      }
      const updated = await res.json() as { status: Enrollment["status"] };
      setEnrollments((prev) => prev.map((e) => (e.id === enrollmentId ? { ...e, status: updated.status } : e)));
    } catch {
      setActionError("Network error — please try again");
    }
  }

  const doneCount = (e: Enrollment) => e.steps.filter((s) => s.status === "DONE").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#1B1B1B]">Action Plans</h3>
        <div className="relative">
          <motion.button
            onClick={() => setShowPlanPicker(!showPlanPicker)}
            disabled={enrolling}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            className="rounded-lg border border-[#9E8C61] bg-[#9E8C61] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {enrolling ? "Enrolling…" : "Apply Plan"}
          </motion.button>
          {showPlanPicker && activePlans.length > 0 && (
            <div className="absolute right-0 top-full mt-1 z-10 w-64 rounded-lg border border-[#1B1B1B]/10 bg-white shadow-lg">
              {activePlans.map((p) => (
                <button
                  key={p.id}
                  onClick={() => enroll(p.id)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F2F0EF] first:rounded-t-lg last:rounded-b-lg"
                >
                  <span className="block font-medium text-[#1B1B1B]">{p.name}</span>
                  <span className="text-xs text-[#1B1B1B]/40">{p.stepCount} steps</span>
                </button>
              ))}
            </div>
          )}
          {showPlanPicker && activePlans.length === 0 && (
            <div className="absolute right-0 top-full mt-1 z-10 w-56 rounded-lg border border-[#1B1B1B]/10 bg-white shadow-lg px-4 py-3">
              <p className="text-xs text-[#1B1B1B]/50">No active plans. Ask your admin to create one.</p>
            </div>
          )}
        </div>
      </div>

      {actionError && <p className="text-sm text-red-500">{actionError}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading && <p className="text-sm text-[#1B1B1B]/40">Loading…</p>}

      {!loading && enrollments.length === 0 && (
        <p className="text-sm text-[#1B1B1B]/40">No action plans applied to this lead.</p>
      )}

      <div className="space-y-3">
        {enrollments.map((enr) => {
          const done = doneCount(enr);
          const total = enr.steps.length;
          const next = enr.steps.find((s) => s.status === "PENDING");
          const isExpanded = expandedId === enr.id;

          return (
            <div key={enr.id} className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF]">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[enr.status]}`}>
                      {enr.status}
                    </span>
                    <span className="text-sm text-[#1B1B1B]">{enr.planName}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#1B1B1B]/50">
                    {done}/{total} steps complete
                    {next && ` · next due ${formatDate(next.dueAt)}`}
                    {enr.pausedReason === "REPLY" && " · paused (lead replied)"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {enr.status === "ACTIVE" && (
                    <button onClick={() => updateEnrollment(enr.id, "PAUSED")} className="text-xs text-[#1B1B1B]/50 hover:text-amber-600">Pause</button>
                  )}
                  {enr.status === "PAUSED" && (
                    <button onClick={() => updateEnrollment(enr.id, "ACTIVE")} className="text-xs text-[#1B1B1B]/50 hover:text-green-600">Resume</button>
                  )}
                  {(enr.status === "ACTIVE" || enr.status === "PAUSED") && (
                    <button onClick={() => updateEnrollment(enr.id, "CANCELLED")} className="text-xs text-[#1B1B1B]/50 hover:text-red-500">Cancel</button>
                  )}
                  <button onClick={() => setExpandedId(isExpanded ? null : enr.id)} className="text-xs text-[#1B1B1B]/40 hover:text-[#1B1B1B]">
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-[#1B1B1B]/10 px-4 py-3 space-y-1.5">
                  {enr.steps.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-xs">
                      <span className={`w-4 text-center font-medium ${STEP_STATUS_COLORS[s.status]}`}>
                        {s.status === "DONE" ? "✓" : s.status === "SKIPPED" ? "—" : s.stepOrder}
                      </span>
                      <span className={`flex-1 ${STEP_STATUS_COLORS[s.status]}`}>
                        {s.stepType === "EMAIL" ? s.subject : s.taskTitle}
                      </span>
                      <span className="text-[#1B1B1B]/30">{formatDate(s.dueAt)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        s.stepType === "EMAIL" ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
                      }`}>{s.stepType}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
