"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

type Application = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  licenseNumber: string;
  licenseType: string;
  status: string;
  createdAt: Date;
};

const STATUS_BADGE: Record<string, string> = {
  PENDING:  "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export function ApplicationsClient({ applications }: { applications: Application[] }) {
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");

  const filtered = filter === "ALL" ? applications : applications.filter((a) => a.status === filter);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              filter === s
                ? "bg-[#1B1B1B] text-white"
                : "border border-[#1B1B1B]/15 text-[#1B1B1B]/60 hover:border-[#1B1B1B]/30"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center font-sans text-sm text-[#1B1B1B]/40">No applications.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#1B1B1B]/10">
          <table className="w-full text-sm">
            <thead className="border-b border-[#1B1B1B]/10 bg-[#F2F0EF]">
              <tr>
                {["Name", "Email", "License #", "Type", "Submitted", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1B1B1B]/5 bg-white">
              {filtered.map((app) => (
                <tr key={app.id} className="hover:bg-[#F2F0EF]/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/applications/${app.id}`} className="font-medium text-[#1B1B1B] hover:text-[#9E8C61]">
                      {app.firstName} {app.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#1B1B1B]/60">{app.email}</td>
                  <td className="px-4 py-3 text-[#1B1B1B]/60">{app.licenseNumber}</td>
                  <td className="px-4 py-3 text-[#1B1B1B]/60">
                    {app.licenseType === "SALESPERSON" ? "Salesperson" : "Broker Assoc."}
                  </td>
                  <td className="px-4 py-3 text-[#1B1B1B]/60">{formatDate(app.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[app.status] ?? ""}`}>
                      {app.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
