"use client";

import { useState } from "react";
import Link from "next/link";
import { LEAD_STATUS_COLORS } from "@/lib/campaign-ui";
import { formatDate } from "@/lib/utils";

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

interface Props {
  leads: LeadRow[];
}

export function AdminLeadsMergeClient({ leads }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);

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
    const loserId = selected.find((s) => s !== winnerId)!;
    await fetch("/api/admin/leads/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winnerId, loserId }),
    });
    setMerging(false);
    setSelected([]);
    window.location.reload();
  }

  const selectedLeads = leads.filter((l) => selected.includes(l.id));

  return (
    <>
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
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/50">
                Lead Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/50">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/50">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/50">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/50">
                Agent
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/50">
                Created
              </th>
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
                    disabled={
                      selected.length >= 2 && !selected.includes(lead.id)
                    }
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
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      LEAD_STATUS_COLORS[lead.status] ??
                      LEAD_STATUS_COLORS.NEW
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
                    <span className="text-[#1B1B1B]/30">Unassigned</span>
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
                  className="w-full rounded-xl border border-[#1B1B1B]/10 px-4 py-3 text-left hover:border-[#9E8C61] hover:bg-[#F2F0EF]"
                >
                  <p className="font-medium text-[#1B1B1B]">
                    {lead.firstName} {lead.lastName}
                  </p>
                  <p className="text-xs text-[#1B1B1B]/50">{lead.email}</p>
                  <p className="mt-1 text-xs font-medium text-[#9E8C61]">
                    Keep this record →
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
    </>
  );
}
