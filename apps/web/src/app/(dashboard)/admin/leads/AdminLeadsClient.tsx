"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LEAD_STATUS_COLORS } from "@/lib/campaign-ui";
import { formatDate } from "@/lib/utils";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { NewLeadModal } from "@/components/leads/NewLeadModal";
import { AssignLeadModal, type AgentOption } from "@/components/leads/AssignLeadModal";
import { PageNumbers } from "@/components/ui/PageNumbers";

type LeadRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  source: string;
  createdAt: string;
  agentEmail: string | null;
};

type UnassignedLead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  source: string;
  createdAt: string;
};

interface Props {
  page: number;
  totalPages: number;
  leads: LeadRow[];
  unassignedLeads: UnassignedLead[];
  agents: AgentOption[];
}

export function AdminLeadsClient({
  page,
  totalPages,
  leads,
  unassignedLeads: initialUnassigned,
  agents,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"all" | "unassigned">("all");
  const [unassigned, setUnassigned] = useState(initialUnassigned);
  const [showModal, setShowModal] = useState(false);

  function handleLeadSaved() {
    router.refresh();
    setShowModal(false);
  }

  // assign pop-up (shared component) — any lead without an agent, either tab
  const [assigningLead, setAssigningLead] = useState<{ id: string; firstName: string; lastName: string } | null>(null);

  function handleAssigned(leadId: string) {
    setUnassigned((prev) => prev.filter((l) => l.id !== leadId));
    setAssigningLead(null);
    router.refresh(); // All Leads row now shows the agent
  }

  // merge state (preserved from AdminLeadsMergeClient)
  const [selected, setSelected] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((s) => s !== id)
        : prev.length < 2
        ? [...prev, id]
        : prev
    );
  }

  async function confirmMerge(winnerId: string) {
    if (isMerging) return;
    setIsMerging(true);
    try {
      const loserId = selected.find((s) => s !== winnerId)!;
      const res = await fetch("/api/admin/leads/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId, loserId }),
      });
      if (!res.ok) {
        alert("Merge failed. Please try again.");
        return;
      }
      setMerging(false);
      setSelected([]);
      window.location.reload();
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setIsMerging(false);
    }
  }

  const selectedLeads = leads.filter((l) => selected.includes(l.id));

  const TABLE_HEAD_CLS =
    "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/50";

  return (
    <>
      {/* Tab bar + Add Lead button */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex flex-1 gap-1 rounded-xl bg-[#F2F0EF] p-1">
          {(["all", "unassigned"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-white text-[#1B1B1B] shadow-sm"
                  : "text-[#1B1B1B]/50 hover:text-[#1B1B1B]"
              }`}
            >
              {t === "all"
                ? "All Leads"
                : `Unassigned${unassigned.length > 0 ? ` (${unassigned.length})` : ""}`}
            </button>
          ))}
        </div>
        <motion.button
          onClick={() => setShowModal(true)}
          className="rounded-full bg-[#1B1B1B] px-5 py-2 text-sm text-white"
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
        >
          + Add Lead
        </motion.button>
      </div>

      {/* ── All Leads tab ── */}
      <div className={tab === "all" ? "" : "hidden"}>
        {selected.length === 2 && (
          <div className="mb-4 flex items-center gap-3 rounded-xl bg-[#F2F0EF] px-4 py-3">
            <p className="text-sm text-[#1B1B1B]">2 leads selected</p>
            <button
              onClick={() => setMerging(true)}
              className="rounded-lg bg-[#1B1B1B] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#9E8C61]"
            >
              Merge Selected
            </button>
            <button
              onClick={() => setSelected([])}
              className="text-sm text-[#1B1B1B]/40 hover:text-[#1B1B1B]"
            >
              Clear
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F2F0EF]">
                <th className="w-10 px-4 py-3" />
                <th className={TABLE_HEAD_CLS}>Lead Name</th>
                <th className={TABLE_HEAD_CLS}>Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">
                  Phone
                </th>
                <th className={TABLE_HEAD_CLS}>Status</th>
                <th className={TABLE_HEAD_CLS}>Source</th>
                <th className={TABLE_HEAD_CLS}>Agent</th>
                <th className={TABLE_HEAD_CLS}>Created</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className={`border-t border-[#1B1B1B]/5 transition-colors ${
                    selected.includes(lead.id)
                      ? "bg-amber-50"
                      : "hover:bg-[#F2F0EF]/50"
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      disabled={selected.length >= 2 && !selected.includes(lead.id)}
                      className="h-4 w-4 accent-[#9E8C61] disabled:opacity-30"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-[#1B1B1B]">
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="hover:underline"
                    >
                      {lead.firstName} {lead.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#1B1B1B]/70">{lead.email}</td>
                  <td className="px-4 py-3 text-[#1B1B1B]/60">
                    {lead.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        LEAD_STATUS_COLORS[lead.status] ?? LEAD_STATUS_COLORS.NEW
                      }`}
                    >
                      {lead.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#1B1B1B]/60">
                    {lead.source}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#1B1B1B]/60">
                    {lead.agentEmail ?? (
                      <motion.button
                        animate={PULSE_ANIMATE}
                        transition={PULSE_TRANSITION}
                        whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
                        onClick={() => setAssigningLead(lead)}
                        className="rounded-lg bg-[#9E8C61] px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Assign
                      </motion.button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#1B1B1B]/60">
                    {formatDate(new Date(lead.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {leads.length === 0 && (
            <p className="py-8 text-center text-sm text-[#1B1B1B]/40">
              No leads yet.
            </p>
          )}
        </div>
        <PageNumbers
          current={page}
          total={totalPages}
          hrefFor={(p) => `/admin/leads?page=${p}`}
        />
      </div>

      {/* ── Unassigned tab ── */}
      <div className={tab === "unassigned" ? "" : "hidden"}>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F2F0EF]">
                <th className={TABLE_HEAD_CLS}>Lead Name</th>
                <th className={TABLE_HEAD_CLS}>Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">
                  Phone
                </th>
                <th className={TABLE_HEAD_CLS}>Status</th>
                <th className={TABLE_HEAD_CLS}>Source</th>
                <th className={TABLE_HEAD_CLS}>Received</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {unassigned.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-t border-[#1B1B1B]/5 transition-colors hover:bg-[#F2F0EF]/50"
                >
                  <td className="px-4 py-3 font-medium text-[#1B1B1B]">
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="hover:underline"
                    >
                      {lead.firstName} {lead.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#1B1B1B]/70">{lead.email}</td>
                  <td className="px-4 py-3 text-[#1B1B1B]/60">
                    {lead.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        LEAD_STATUS_COLORS[lead.status] ?? LEAD_STATUS_COLORS.NEW
                      }`}
                    >
                      {lead.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#1B1B1B]/60">
                    {lead.source}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#1B1B1B]/60">
                    {formatDate(new Date(lead.createdAt))}
                  </td>
                  <td className="px-4 py-3">
                    <motion.button
                      animate={PULSE_ANIMATE}
                      transition={PULSE_TRANSITION}
                      whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
                      onClick={() => setAssigningLead(lead)}
                      className="rounded-lg bg-[#9E8C61] px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Assign
                    </motion.button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {unassigned.length === 0 && (
            <p className="py-8 text-center text-sm text-[#1B1B1B]/40">
              No unassigned leads — you&apos;re all caught up.
            </p>
          )}
        </div>
      </div>

      {/* ── Merge modal ── */}
      {merging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 font-sans text-lg font-light text-[#1B1B1B]">
              Merge Leads
            </h3>
            <p className="mb-4 text-sm text-[#1B1B1B]/60">
              Choose which lead record to keep. The other will be deleted and
              its activities transferred.
            </p>
            <div className="space-y-2">
              {selectedLeads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => confirmMerge(lead.id)}
                  disabled={isMerging}
                  className="w-full rounded-xl border border-[#1B1B1B]/10 px-4 py-3 text-left hover:border-[#9E8C61] hover:bg-[#F2F0EF] disabled:opacity-50"
                >
                  <p className="font-medium text-[#1B1B1B]">
                    {lead.firstName} {lead.lastName}
                  </p>
                  <p className="text-xs text-[#1B1B1B]/50">{lead.email}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#9E8C61]">
                    {isMerging ? "Merging..." : <>Keep this record <ArrowIcon /></>}
                  </p>
                </button>
              ))}
            </div>
            <button
              onClick={() => setMerging(false)}
              className="mt-3 w-full rounded-lg border border-[#1B1B1B]/10 py-2 text-sm text-[#1B1B1B]/50 hover:bg-[#F2F0EF]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Assign pop-up ── */}
      {assigningLead && (
        <AssignLeadModal
          key={assigningLead.id}
          lead={assigningLead}
          agents={agents}
          onAssigned={handleAssigned}
          onClose={() => setAssigningLead(null)}
        />
      )}

      {/* ── Add Lead modal ── */}
      <NewLeadModal open={showModal} onClose={() => setShowModal(false)} onSaved={handleLeadSaved} />
    </>
  );
}
