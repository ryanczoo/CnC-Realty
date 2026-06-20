"use client";

import { useState, useEffect } from "react";
import { StatsCard } from "@/components/dashboard/StatsCard";

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

type OverviewStats = {
  total: number;
  newThisWeek: number;
  active: number;
  closed: number;
};

type MyStatsData = {
  summary: {
    leadsThisPeriod: number;
    activitiesLogged: number;
    dealsInPipeline: number;
    dealsClosed: number;
  };
  sourceBreakdown: { source: string; count: number; percent: number }[];
  activityBreakdown: { type: string; count: number }[];
};

export function DashboardTabs({ overviewStats }: { overviewStats: OverviewStats }) {
  const [tab, setTab] = useState<"overview" | "my-stats">("overview");
  const [range, setRange] = useState<RangeValue>("month");
  const [myStats, setMyStats] = useState<MyStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch my stats whenever the tab is active or range changes
  useEffect(() => {
    if (tab !== "my-stats") return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/reports/my-stats?range=${range}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load stats");
        return r.json();
      })
      .then(setMyStats)
      .catch((e) => { if (e.name !== "AbortError") setError("Failed to load stats"); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [tab, range]);

  return (
    <div>
      {/* Tab switcher */}
      <div className="mb-6 flex gap-2">
        {(["overview", "my-stats"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "border-[#9E8C61] bg-[#9E8C61] text-white"
                : "border-[#1B1B1B]/20 text-[#1B1B1B]/60 hover:border-[#9E8C61] hover:text-[#9E8C61]"
            }`}
          >
            {t === "overview" ? "Overview" : "My Stats"}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      <div className={tab === "overview" ? "" : "hidden"}>
        <h1 className="mb-8 font-sans text-2xl font-light text-[#1B1B1B]">Overview</h1>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard label="Total Leads" value={overviewStats.total} />
          <StatsCard label="New This Week" value={overviewStats.newThisWeek} />
          <StatsCard label="Active Pipeline" value={overviewStats.active} />
          <StatsCard label="Closed" value={overviewStats.closed} />
        </div>
      </div>

      {/* My Stats tab */}
      <div className={tab === "my-stats" ? "" : "hidden"}>
        <div className="mb-6 flex flex-wrap gap-2">
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

        {loading && <p className="text-sm text-[#1B1B1B]/40">Loading…</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!loading && !error && myStats && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatsCard label="Leads This Period" value={myStats.summary.leadsThisPeriod} />
              <StatsCard label="Activities Logged" value={myStats.summary.activitiesLogged} />
              <StatsCard label="Deals in Pipeline" value={myStats.summary.dealsInPipeline} />
              <StatsCard label="Deals Closed" value={myStats.summary.dealsClosed} />
            </div>

            {/* My Lead Sources */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="border-b border-[#1B1B1B]/5 px-5 py-3">
                <h2 className="text-sm font-medium text-[#1B1B1B]">My Lead Sources</h2>
              </div>
              {myStats.sourceBreakdown.length === 0 ? (
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
                    {myStats.sourceBreakdown.map((row, i) => (
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

            {/* My Activity Breakdown */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="border-b border-[#1B1B1B]/5 px-5 py-3">
                <h2 className="text-sm font-medium text-[#1B1B1B]">My Activity Breakdown</h2>
              </div>
              <div className="flex flex-wrap gap-4 px-5 py-4">
                {myStats.activityBreakdown.map((row) => (
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
          </div>
        )}
      </div>
    </div>
  );
}
