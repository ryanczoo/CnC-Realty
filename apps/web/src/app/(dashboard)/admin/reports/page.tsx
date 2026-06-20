"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

type RangeValue = "week" | "month" | "30d" | "90d" | "year" | "all";

const RANGES: { value: RangeValue; label: string }[] = [
  { value: "week",  label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "30d",   label: "Last 30 Days" },
  { value: "90d",   label: "Last 90 Days" },
  { value: "year",  label: "This Year" },
  { value: "all",   label: "All Time" },
];

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE:    "Website",
  REFERRAL:   "Referral",
  SOCIAL:     "Social Media",
  OPEN_HOUSE: "Open House",
  COLD_CALL:  "Cold Call",
  OTHER:      "Other",
};

const ACTIVITY_LABELS: Record<string, string> = {
  NOTE:     "Note",
  CALL:     "Call",
  EMAIL:    "Email",
  SHOWING:  "Showing",
  OFFER:    "Offer",
  DOCUMENT: "Document",
};

type LeaderboardRow = {
  agentId: string;
  displayName: string | null;
  leadsOwned: number;
  activitiesLogged: number;
  dealsInPipeline: number;
  dealsClosed: number;
};

type SourceRow = { source: string; count: number; percent: number };
type ActivityRow = { type: string; count: number };
type SpeedRow = { agentId: string; displayName: string | null; avgHours: number | null; display: string };

type ReportData = {
  leaderboard: LeaderboardRow[];
  sourceBreakdown: SourceRow[];
  activityVolume: ActivityRow[];
  speedToLead: SpeedRow[];
};

export default function AdminReportsPage() {
  const [range, setRange] = useState<RangeValue>("month");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/reports?range=${range}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load reports");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Failed to load reports"))
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Reports</h1>
          <p className="mt-1 text-sm text-[#1B1B1B]/40">Performance metrics for your team</p>
        </div>
        {/* Range picker */}
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                range === r.value
                  ? "border-[#9E8C61] bg-[#9E8C61] text-white"
                  : "border-[#1B1B1B]/20 text-[#1B1B1B]/60 hover:border-[#9E8C61] hover:text-[#9E8C61]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-[#1B1B1B]/40">Loading…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && data && (
        <>
          {/* Leaderboard */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b border-[#1B1B1B]/5 px-5 py-3">
              <h2 className="text-sm font-medium text-[#1B1B1B]">Leaderboard</h2>
            </div>
            {data.leaderboard.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#1B1B1B]/40">
                No agent data for this period.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1B1B1B]/5 text-xs text-[#1B1B1B]/40">
                    <th className="px-5 py-2 text-left font-medium">Agent</th>
                    <th className="px-5 py-2 text-right font-medium">Leads</th>
                    <th className="px-5 py-2 text-right font-medium">Activities</th>
                    <th className="px-5 py-2 text-right font-medium">Pipeline</th>
                    <th className="px-5 py-2 text-right font-medium">Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leaderboard.map((row, i) => (
                    <tr
                      key={row.agentId}
                      className={i > 0 ? "border-t border-[#1B1B1B]/5" : ""}
                    >
                      <td className="px-5 py-3 font-medium text-[#1B1B1B]">
                        {row.displayName ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                        {row.leadsOwned}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                        {row.activitiesLogged}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                        {row.dealsInPipeline}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                        {row.dealsClosed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Lead Sources + Speed-to-Lead side by side */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Lead Sources */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="border-b border-[#1B1B1B]/5 px-5 py-3">
                <h2 className="text-sm font-medium text-[#1B1B1B]">Lead Sources</h2>
              </div>
              {data.sourceBreakdown.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-[#1B1B1B]/40">
                  No leads for this period.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1B1B1B]/5 text-xs text-[#1B1B1B]/40">
                      <th className="px-5 py-2 text-left font-medium">Source</th>
                      <th className="px-5 py-2 text-right font-medium">Count</th>
                      <th className="px-5 py-2 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sourceBreakdown.map((row, i) => (
                      <tr
                        key={row.source}
                        className={i > 0 ? "border-t border-[#1B1B1B]/5" : ""}
                      >
                        <td className="px-5 py-3 text-[#1B1B1B]">
                          {SOURCE_LABELS[row.source] ?? row.source}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                          {row.count}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                          {row.percent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Speed to Lead */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="border-b border-[#1B1B1B]/5 px-5 py-3">
                <h2 className="text-sm font-medium text-[#1B1B1B]">Speed to Lead</h2>
              </div>
              {data.speedToLead.every((r) => r.avgHours === null) ? (
                <p className="px-5 py-8 text-center text-sm text-[#1B1B1B]/40">
                  No contact data for this period.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1B1B1B]/5 text-xs text-[#1B1B1B]/40">
                      <th className="px-5 py-2 text-left font-medium">Agent</th>
                      <th className="px-5 py-2 text-right font-medium">Avg Response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.speedToLead.map((row, i) => (
                      <tr
                        key={row.agentId}
                        className={i > 0 ? "border-t border-[#1B1B1B]/5" : ""}
                      >
                        <td className="px-5 py-3 text-[#1B1B1B]">
                          {row.displayName ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#1B1B1B]/70">
                          {row.display}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Activity Volume */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-b border-[#1B1B1B]/5 px-5 py-3">
              <h2 className="text-sm font-medium text-[#1B1B1B]">Activity Volume</h2>
            </div>
            <div className="flex flex-wrap gap-4 px-5 py-4">
              {data.activityVolume.map((row) => (
                <div
                  key={row.type}
                  className="rounded-xl border border-[#1B1B1B]/10 px-4 py-2"
                >
                  <span className="text-xs font-medium text-[#1B1B1B]/50">
                    {ACTIVITY_LABELS[row.type] ?? row.type}:
                  </span>{" "}
                  <span className="tabular-nums text-sm font-medium text-[#1B1B1B]">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
