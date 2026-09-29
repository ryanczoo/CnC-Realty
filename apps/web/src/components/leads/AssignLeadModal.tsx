"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { assignLead } from "@/lib/assign-lead";

export type AgentOption = { id: string; displayName: string | null; user: { email: string } };

// The "Assign Lead" pop-up: pick an agent, and the lead becomes theirs (the
// agent gets the "You Just Got A Lead!" email). Used by both All Leads tabs.
export function AssignLeadModal({
  lead,
  agents,
  onAssigned,
  onClose,
}: {
  lead: { id: string; firstName: string; lastName: string };
  agents: AgentOption[];
  onAssigned: (leadId: string) => void;
  onClose: () => void;
}) {
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  async function handleAssign() {
    if (!selectedAgentId || assigning) return;
    setAssigning(true);
    setAssignError("");
    const result = await assignLead(lead.id, selectedAgentId);
    setAssigning(false);
    if (!result.ok) {
      setAssignError(result.error);
      return;
    }
    onAssigned(lead.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-1 font-sans text-lg font-light text-[#1B1B1B]">Assign Lead</h3>
        <p className="mb-4 text-sm text-[#1B1B1B]/60">
          {lead.firstName} {lead.lastName}
        </p>
        <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/50">Select Agent</label>
        <select
          value={selectedAgentId}
          onChange={(e) => {
            setSelectedAgentId(e.target.value);
            setAssignError("");
          }}
          className="mb-4 w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm text-[#1B1B1B] focus:outline-none focus:ring-1 focus:ring-[#9E8C61]"
        >
          <option value="">— Choose an agent —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName ?? a.user.email}
            </option>
          ))}
        </select>
        {assignError && <p className="mb-3 text-xs text-red-600">{assignError}</p>}
        <div className="flex gap-2">
          <motion.button
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            onClick={handleAssign}
            disabled={!selectedAgentId || assigning}
            className="flex-1 rounded-lg bg-[#9E8C61] py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {assigning ? "Assigning..." : "Assign"}
          </motion.button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#1B1B1B]/10 py-2 text-sm text-[#1B1B1B]/50 hover:bg-[#F2F0EF]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
