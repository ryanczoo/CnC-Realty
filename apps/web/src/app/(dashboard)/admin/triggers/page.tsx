"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { TriggerDrawer } from "@/components/triggers/TriggerDrawer";

type TriggerRow = {
  id: string;
  name: string;
  statusTrigger: string;
  actionType: "ENROLL_PLAN" | "SEND_EMAIL";
  actionPlanId: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  isActive: boolean;
  createdAt: string;
  actionPlan: { name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  HOT_PROSPECT: "Hot Prospect",
  NURTURE: "Nurture",
  SHOWING: "Showing",
  OFFER: "Offer",
  UNDER_CONTRACT: "Under Contract",
  CLOSED: "Closed",
  LOST: "Lost",
  SPHERE: "Sphere of Influence",
};

export const dynamic = "force-dynamic";

export default function TriggersAdminPage() {
  const [triggers, setTriggers] = useState<TriggerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<TriggerRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function loadTriggers() {
    setLoading(true);
    fetch("/api/admin/triggers")
      .then((r) => r.json())
      .then(setTriggers)
      .catch(() => setError("Failed to load triggers"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadTriggers(); }, []);

  async function handleToggleActive(trigger: TriggerRow) {
    await fetch(`/api/admin/triggers/${trigger.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !trigger.isActive }),
    });
    loadTriggers();
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await fetch(`/api/admin/triggers/${id}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      loadTriggers();
    } finally {
      setDeleting(false);
    }
  }

  function openCreate() {
    setEditingTrigger(null);
    setDrawerOpen(true);
  }

  function openEdit(trigger: TriggerRow) {
    setEditingTrigger(trigger);
    setDrawerOpen(true);
  }

  function actionDescription(t: TriggerRow): string {
    if (t.actionType === "ENROLL_PLAN") {
      return `Enroll in "${t.actionPlan?.name ?? "Unknown Plan"}"`;
    }
    return `Send email: "${t.emailSubject}"`;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Trigger Automations</h1>
          <p className="mt-1 text-sm text-[#1B1B1B]/40">
            Automatically act when a lead&apos;s status changes
          </p>
        </div>
        <motion.button
          onClick={openCreate}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          className="rounded-full bg-[#1B1B1B] px-5 py-2.5 text-sm font-medium text-white"
        >
          + New Trigger
        </motion.button>
      </div>

      {loading && <Loader2 className="h-6 w-6 animate-spin text-[#9E8C61]" />}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && triggers.length === 0 && (
        <p className="py-12 text-center text-sm text-[#1B1B1B]/40">
          No triggers yet — create one to start automating your workflow.
        </p>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {triggers.map((trigger, i) => (
          <div
            key={trigger.id}
            className={`flex items-center gap-4 px-5 py-4 ${
              i > 0 ? "border-t border-[#1B1B1B]/5" : ""
            }`}
          >
            {/* Active toggle */}
            <input
              type="checkbox"
              checked={trigger.isActive}
              onChange={() => handleToggleActive(trigger)}
              className="h-4 w-4 accent-[#9E8C61]"
              title={trigger.isActive ? "Disable trigger" : "Enable trigger"}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1B1B1B]">{trigger.name}</p>
              <p className="mt-0.5 text-xs text-[#1B1B1B]/50">
                Status → {STATUS_LABELS[trigger.statusTrigger] ?? trigger.statusTrigger}
                {" · "}
                {actionDescription(trigger)}
              </p>
            </div>

            {/* Active badge */}
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                trigger.isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-[#1B1B1B]/10 text-[#1B1B1B]/40"
              }`}
            >
              {trigger.isActive ? "Active" : "Inactive"}
            </span>

            {/* Edit */}
            <button
              onClick={() => openEdit(trigger)}
              className="shrink-0 text-xs text-[#1B1B1B]/40 hover:text-[#1B1B1B]"
              title="Edit"
            >
              Edit
            </button>

            {/* Delete / confirm */}
            {confirmDeleteId === trigger.id ? (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-[#1B1B1B]/50">Delete?</span>
                <button
                  onClick={() => handleDelete(trigger.id)}
                  disabled={deleting}
                  className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {deleting ? "…" : "Confirm"}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="text-xs text-[#1B1B1B]/40 hover:text-[#1B1B1B]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(trigger.id)}
                className="shrink-0 text-xs text-[#1B1B1B]/40 hover:text-red-500"
                title="Delete"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>

      <TriggerDrawer
        open={drawerOpen}
        trigger={editingTrigger}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => { setDrawerOpen(false); loadTriggers(); }}
      />
    </div>
  );
}
