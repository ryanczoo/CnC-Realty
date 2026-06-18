"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LEAD_STATUS_COLORS } from "@/lib/campaign-ui";
import { resolveListFilters, PREBUILT_LISTS } from "@/lib/smart-list-filters";
import type { FilterCondition } from "@/lib/smart-list-filters";

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  HOT_PROSPECT: "Hot Prospect",
  NURTURE: "Nurture",
  SHOWING: "Showing",
  OFFER: "Offer",
  UNDER_CONTRACT: "Under Contract",
  CLOSED: "Past Client",
  LOST: "Dead Lead",
  SPHERE: "Sphere",
};

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: "Website",
  REFERRAL: "Referral",
  SOCIAL: "Social",
  OPEN_HOUSE: "Open House",
  COLD_CALL: "Cold Call",
  OTHER: "Other",
};

type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  source: string;
  priceMin: number | null;
  priceMax: number | null;
  lastContactedAt: string | null;
  tags: Array<{ tag: { name: string; color: string } }>;
};

type CustomList = { id: string; name: string; filters: unknown };

type Props = {
  activeList: string;
  customLists: CustomList[];
};

const PAGE_SIZE = 25;

function formatLastContacted(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function formatPrice(min: number | null, max: number | null): string {
  if (!min && !max) return "—";
  const fmt = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
  if (min && max) return `${fmt(min)}–${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `Up to ${fmt(max!)}`;
}

function resolveListName(activeList: string, customLists: CustomList[]): string {
  const prebuilt = PREBUILT_LISTS.find(l => l.slug === activeList);
  if (prebuilt) return prebuilt.name;
  const custom = customLists.find(l => l.id === activeList);
  if (custom) return custom.name;
  return "Smart List";
}

export function SmartListResults({ activeList, customLists }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterCondition[] | null>(null);

  // Resolve filters whenever activeList or customLists change
  useEffect(() => {
    const resolved = resolveListFilters(activeList, customLists);
    setFilters(resolved);
    setPage(1);
  }, [activeList, customLists]);

  // Fetch leads whenever filters or page change
  useEffect(() => {
    if (filters === null) return;

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({
      filters: JSON.stringify(filters),
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });

    fetch(`/api/leads?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          setLeads(data.leads ?? []);
          setTotal(data.total ?? 0);
        }
      })
      .catch(() => {
        if (!cancelled) setLeads([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [filters, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const listName = resolveListName(activeList, customLists);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">{listName}</h1>
        {!loading && (
          <p className="font-sans text-sm text-[#1B1B1B]/40">
            {total} lead{total !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="py-12 text-center font-sans text-sm text-[#1B1B1B]/40">
          Loading…
        </div>
      ) : leads.length === 0 ? (
        /* Empty state */
        <div className="rounded-2xl bg-white p-12 text-center">
          <p className="font-sans text-sm text-[#1B1B1B]/50">No leads match this list</p>
          <p className="mt-1 font-sans text-xs text-[#1B1B1B]/30">
            Leads appear here automatically as they meet the filter criteria
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-hidden rounded-2xl bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1B1B1B]/10">
                  {["Name", "Status", "Tags", "Last Contacted", "Source", "Price Range"].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left font-sans text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/40"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <tr
                    key={lead.id}
                    className={i > 0 ? "border-t border-[#1B1B1B]/5" : ""}
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/leads/${lead.id}`}
                        className="font-sans text-sm text-[#1B1B1B] hover:text-[#9E8C61]"
                      >
                        {lead.firstName} {lead.lastName}
                      </Link>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 font-sans text-xs font-medium ${
                          LEAD_STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {STATUS_LABELS[lead.status] ?? lead.status}
                      </span>
                    </td>

                    {/* Tags */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {lead.tags.slice(0, 3).map(t => (
                          <span
                            key={t.tag.name}
                            className="inline-flex rounded-full px-2 py-0.5 font-sans text-xs font-medium text-white"
                            style={{ backgroundColor: t.tag.color }}
                          >
                            {t.tag.name}
                          </span>
                        ))}
                        {lead.tags.length > 3 && (
                          <span className="font-sans text-xs text-[#1B1B1B]/40">
                            +{lead.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Last Contacted */}
                    <td className="px-4 py-3 font-sans text-sm text-[#1B1B1B]/60">
                      {formatLastContacted(lead.lastContactedAt)}
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3 font-sans text-sm text-[#1B1B1B]/60">
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                    </td>

                    {/* Price Range */}
                    <td className="px-4 py-3 font-sans text-sm text-[#1B1B1B]/60">
                      {formatPrice(lead.priceMin, lead.priceMax)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg px-4 py-2 font-sans text-sm text-[#1B1B1B]/60 hover:text-[#1B1B1B] disabled:opacity-30"
              >
                ← Previous
              </button>
              <span className="font-sans text-sm text-[#1B1B1B]/40">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg px-4 py-2 font-sans text-sm text-[#1B1B1B]/60 hover:text-[#1B1B1B] disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
