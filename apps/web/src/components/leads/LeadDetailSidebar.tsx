"use client";

import { useState } from "react";
import { TagPicker } from "./TagPicker";
import { RelationshipSection } from "./RelationshipSection";

type Tag = { id: string; name: string; color: string };
type Relationship = { id: string; type: string; lead: { id: string; firstName: string; lastName: string; email: string } };

const FIELD_CLS = "w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm text-[#1B1B1B]";
const FIELD_CLS_SM = "w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-1.5 text-sm text-[#1B1B1B]";

const STATUSES = [
  { value: "NEW", label: "New Lead" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "HOT_PROSPECT", label: "Hot Prospect" },
  { value: "NURTURE", label: "Nurture" },
  { value: "SHOWING", label: "Showing" },
  { value: "OFFER", label: "Offer" },
  { value: "UNDER_CONTRACT", label: "Under Contract" },
  { value: "CLOSED", label: "Past Client" },
  { value: "LOST", label: "Dead Lead" },
  { value: "SPHERE", label: "Sphere" },
];

const TIMEFRAMES = ["0-3 months","3-6 months","6-12 months","12+ months"];

interface Props {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    status: string;
    source: string;
    score: number;
    priceMin: number | null;
    priceMax: number | null;
    timeframeToMove: string | null;
    lastContactedAt: string | null;
    createdAt: string;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    tags: { tag: Tag }[];
    relationshipsFrom: Relationship[];
    relationshipsTo: Relationship[];
  };
  onRefresh: () => void;
}

export function LeadDetailSidebar({ lead, onRefresh }: Props) {
  const [tags, setTags] = useState<Tag[]>(lead.tags.map((t) => t.tag));

  const allRelationships = [
    ...lead.relationshipsFrom.map((r) => ({ id: r.id, type: r.type, lead: r.lead })),
    ...lead.relationshipsTo.map((r) => ({ id: r.id, type: r.type, lead: r.lead })),
  ];

  async function patch(data: Record<string, unknown>) {
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    onRefresh();
  }

  const initials = `${lead.firstName[0] ?? ""}${lead.lastName[0] ?? ""}`.toUpperCase();
  const lastContacted = lead.lastContactedAt
    ? `${Math.floor((Date.now() - new Date(lead.lastContactedAt).getTime()) / 86400000)} days ago`
    : "Never contacted";

  return (
    <div className="space-y-4">
      {/* Contact Card */}
      <div className="rounded-2xl bg-white p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#9E8C61] font-sans text-lg font-medium text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate font-sans text-base font-medium text-[#1B1B1B]">
              {lead.firstName} {lead.lastName}
            </p>
            <p className="truncate text-sm text-[#1B1B1B]/50">{lead.email}</p>
            {lead.phone && <p className="text-sm text-[#1B1B1B]/50">{lead.phone}</p>}
          </div>
        </div>

        <label className="mb-1 block text-xs text-[#1B1B1B]/40">Stage</label>
        <select
          defaultValue={lead.status}
          onChange={(e) => patch({ status: e.target.value })}
          className={FIELD_CLS}
        >
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <div className="mt-3 flex items-center justify-between text-xs text-[#1B1B1B]/40">
          <span>Last contact: {lastContacted}</span>
          <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Tags */}
      <div className="rounded-2xl bg-white p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Tags</p>
        <TagPicker
          leadId={lead.id}
          applied={tags}
          onApplied={(tag) => setTags((prev) => [...prev, tag])}
          onRemoved={(tagId) => setTags((prev) => prev.filter((t) => t.id !== tagId))}
        />
      </div>

      {/* Lead Details */}
      <div className="rounded-2xl bg-white p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Lead Details</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/40">Price Range</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min $"
                defaultValue={lead.priceMin ?? ""}
                onBlur={(e) => patch({ priceMin: e.target.value ? Number(e.target.value) : null })}
                className={FIELD_CLS_SM}
              />
              <input
                type="number"
                placeholder="Max $"
                defaultValue={lead.priceMax ?? ""}
                onBlur={(e) => patch({ priceMax: e.target.value ? Number(e.target.value) : null })}
                className={FIELD_CLS_SM}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/40">Timeframe</label>
            <select
              defaultValue={lead.timeframeToMove ?? ""}
              onChange={(e) => patch({ timeframeToMove: e.target.value || null })}
              className={FIELD_CLS}
            >
              <option value="">Unknown</option>
              {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {(lead.utmSource || lead.utmMedium || lead.utmCampaign) && (
            <details className="text-xs text-[#1B1B1B]/40">
              <summary className="cursor-pointer">Campaign details</summary>
              <div className="mt-1 space-y-0.5 pl-2">
                {lead.utmSource && <p>Source: {lead.utmSource}</p>}
                {lead.utmMedium && <p>Medium: {lead.utmMedium}</p>}
                {lead.utmCampaign && <p>Campaign: {lead.utmCampaign}</p>}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Relationships */}
      <div className="rounded-2xl bg-white p-5">
        <RelationshipSection leadId={lead.id} relationships={allRelationships} onChanged={onRefresh} />
      </div>
    </div>
  );
}
