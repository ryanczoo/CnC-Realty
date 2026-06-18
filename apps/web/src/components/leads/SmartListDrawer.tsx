"use client";

import { useEffect, useRef, useState } from "react";
import type { FilterCondition } from "@/lib/smart-list-filters";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = [
  { value: "NEW_LEAD",          label: "New Lead" },
  { value: "ATTEMPTING_CONTACT",label: "Attempting Contact" },
  { value: "CONTACT_MADE",      label: "Contact Made" },
  { value: "APPOINTMENT_SET",   label: "Appointment Set" },
  { value: "APPOINTMENT_MET",   label: "Appointment Met" },
  { value: "NURTURE",           label: "Nurture" },
  { value: "HOT_PROSPECT",      label: "Hot Prospect" },
  { value: "SPHERE",            label: "Sphere" },
  { value: "UNDER_CONTRACT",    label: "Under Contract" },
  { value: "CLOSED",            label: "Closed" },
  { value: "LOST",              label: "Lost" },
];

const SOURCES = [
  { value: "AGENT_OUTREACH", label: "Agent Outreach" },
  { value: "REFERRAL",       label: "Referral" },
  { value: "OPEN_HOUSE",     label: "Open House" },
  { value: "WEBSITE",        label: "Website" },
  { value: "SOCIAL_MEDIA",   label: "Social Media" },
  { value: "ZILLOW",         label: "Zillow" },
  { value: "REALTOR_COM",    label: "Realtor.com" },
  { value: "OTHER",          label: "Other" },
];

const TIMEFRAMES = [
  "0-3 months",
  "3-6 months",
  "6-12 months",
  "12+ months",
  "Unknown",
];

const FIELDS = [
  { value: "status",         label: "Status" },
  { value: "tags",           label: "Tags" },
  { value: "lastContacted",  label: "Last Contacted" },
  { value: "timeframe",      label: "Timeframe to Move" },
  { value: "source",         label: "Source" },
  { value: "priceMin",       label: "Min Budget" },
  { value: "priceMax",       label: "Max Budget" },
  { value: "hasPendingTask", label: "Has Pending Task" },
  { value: "createdDate",    label: "Created Date" },
];

const FIELD_OPERATORS: Record<string, Array<{ value: string; label: string }>> = {
  status:         [{ value: "is", label: "is" }, { value: "isNot", label: "is not" }],
  tags:           [{ value: "hasAnyOf", label: "has any of" }, { value: "hasNoneOf", label: "has none of" }],
  lastContacted:  [
    { value: "moreThan", label: "more than X days ago" },
    { value: "lessThan", label: "less than X days ago" },
    { value: "never",    label: "never contacted" },
  ],
  timeframe:      [{ value: "is", label: "is" }],
  source:         [{ value: "is", label: "is" }, { value: "isNot", label: "is not" }],
  priceMin:       [{ value: "atLeast", label: "at least" }],
  priceMax:       [{ value: "atMost",  label: "at most" }],
  hasPendingTask: [{ value: "is", label: "is" }],
  createdDate:    [
    { value: "withinLast", label: "within last X days" },
    { value: "moreThan",   label: "more than X days ago" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultOperator(field: string): string {
  return FIELD_OPERATORS[field]?.[0]?.value ?? "is";
}

function defaultValue(field: string, operator: string): unknown {
  if (field === "status" || field === "source" || field === "tags") return [];
  if (field === "hasPendingTask") return true;
  if (field === "lastContacted" && operator === "never") return null;
  if (field === "timeframe") return TIMEFRAMES[0];
  return 30;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TagOption = { id: string; name: string; color: string };
type ConditionRow = { field: string; operator: string; value: unknown };

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: { id: string; name: string; filters: FilterCondition[] };
  onSaved: (list: { id: string; name: string; filters: unknown }) => void;
};

// ─── Select helpers ───────────────────────────────────────────────────────────

const selectCls =
  "w-full rounded border border-[#1B1B1B]/10 bg-white px-2 py-1.5 font-sans text-sm text-[#1B1B1B] focus:outline-none focus:ring-1 focus:ring-[#9E8C61]";

const inputCls =
  "w-full rounded border border-[#1B1B1B]/10 bg-white px-3 py-1.5 font-sans text-sm text-[#1B1B1B] focus:outline-none focus:ring-1 focus:ring-[#9E8C61]";

// ─── Component ────────────────────────────────────────────────────────────────

export function SmartListDrawer({ open, onClose, initial, onSaved }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [conditions, setConditions] = useState<ConditionRow[]>(() => {
    if (!initial?.filters?.length) return [];
    try { return initial.filters.map(f => ({ ...f })); }
    catch { return []; }
  });
  const [tags, setTags] = useState<TagOption[]>([]);
  const [saving, setSaving] = useState(false);

  // Sync state when `initial` changes (edit mode switch)
  const prevInitialId = useRef<string | undefined>(initial?.id);
  useEffect(() => {
    if (initial?.id !== prevInitialId.current) {
      prevInitialId.current = initial?.id;
      setName(initial?.name ?? "");
      setConditions(() => {
        if (!initial?.filters?.length) return [];
        try { return initial.filters.map(f => ({ ...f })); }
        catch { return []; }
      });
    }
  }, [initial]);

  // Reset when switching between create / edit
  useEffect(() => {
    if (!open) return;
    if (!initial) {
      setName("");
      setConditions([]);
    }
  }, [open, initial]);

  // Fetch tags once on mount
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/tags", { signal: controller.signal })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTags(data); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // ── Condition helpers ──────────────────────────────────────────────────────

  function addCondition() {
    const field = "status";
    const operator = defaultOperator(field);
    setConditions(prev => [...prev, { field, operator, value: defaultValue(field, operator) }]);
  }

  function updateField(i: number, field: string) {
    const operator = defaultOperator(field);
    setConditions(prev =>
      prev.map((c, idx) => idx === i ? { field, operator, value: defaultValue(field, operator) } : c),
    );
  }

  function updateOperator(i: number, operator: string) {
    setConditions(prev =>
      prev.map((c, idx) => {
        if (idx !== i) return c;
        const value =
          c.field === "lastContacted" && operator === "never"
            ? null
            : typeof c.value === "number"
              ? c.value
              : defaultValue(c.field, operator);
        return { ...c, operator, value };
      }),
    );
  }

  function updateValue(i: number, value: unknown) {
    setConditions(prev => prev.map((c, idx) => idx === i ? { ...c, value } : c));
  }

  function removeCondition(i: number) {
    setConditions(prev => prev.filter((_, idx) => idx !== i));
  }

  function toggleArrayValue(i: number, val: string) {
    setConditions(prev =>
      prev.map((c, idx) => {
        if (idx !== i) return c;
        const arr = Array.isArray(c.value) ? (c.value as string[]) : [];
        const next = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
        return { ...c, value: next };
      }),
    );
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!name.trim() || conditions.length === 0) return;
    setSaving(true);
    try {
      const url = initial ? `/api/smart-lists/${initial.id}` : "/api/smart-lists";
      const method = initial ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), filters: conditions }),
      });
      if (!res.ok) return;
      const saved = await res.json();
      onSaved({ id: saved.id, name: saved.name, filters: saved.filters });
    } finally {
      setSaving(false);
    }
  }

  // ── Value input renderer ─────────────────────────────────────────────────

  function renderValueInput(condition: ConditionRow, i: number) {
    const { field, operator, value } = condition;

    if (field === "lastContacted" && operator === "never") return null;

    if (field === "status") {
      return (
        <div className="max-h-40 overflow-y-auto rounded border border-[#1B1B1B]/10 p-2">
          {STATUSES.map(s => (
            <label
              key={s.value}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-[#F2F0EF]"
            >
              <input
                type="checkbox"
                checked={Array.isArray(value) && (value as string[]).includes(s.value)}
                onChange={() => toggleArrayValue(i, s.value)}
                className="accent-[#9E8C61]"
              />
              <span className="font-sans text-sm text-[#1B1B1B]">{s.label}</span>
            </label>
          ))}
        </div>
      );
    }

    if (field === "source") {
      return (
        <div className="rounded border border-[#1B1B1B]/10 p-2">
          {SOURCES.map(s => (
            <label
              key={s.value}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-[#F2F0EF]"
            >
              <input
                type="checkbox"
                checked={Array.isArray(value) && (value as string[]).includes(s.value)}
                onChange={() => toggleArrayValue(i, s.value)}
                className="accent-[#9E8C61]"
              />
              <span className="font-sans text-sm text-[#1B1B1B]">{s.label}</span>
            </label>
          ))}
        </div>
      );
    }

    if (field === "tags") {
      return (
        <div className="max-h-40 overflow-y-auto rounded border border-[#1B1B1B]/10 p-2">
          {tags.length === 0 && (
            <p className="font-sans text-xs text-[#1B1B1B]/40">No tags yet</p>
          )}
          {tags.map(t => (
            <label
              key={t.id}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-[#F2F0EF]"
            >
              <input
                type="checkbox"
                checked={Array.isArray(value) && (value as string[]).includes(t.name)}
                onChange={() => toggleArrayValue(i, t.name)}
                className="accent-[#9E8C61]"
              />
              <span
                className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                style={{ backgroundColor: t.color }}
              />
              <span className="font-sans text-sm text-[#1B1B1B]">{t.name}</span>
            </label>
          ))}
        </div>
      );
    }

    if (field === "timeframe") {
      return (
        <select
          value={value as string}
          onChange={e => updateValue(i, e.target.value)}
          className={selectCls}
        >
          {TIMEFRAMES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      );
    }

    if (field === "hasPendingTask") {
      return (
        <select
          value={String(value)}
          onChange={e => updateValue(i, e.target.value === "true")}
          className={selectCls}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }

    // Number input: lastContacted days, priceMin, priceMax, createdDate
    return (
      <input
        type="number"
        value={(value as number) ?? ""}
        onChange={e => updateValue(i, Number(e.target.value))}
        min={0}
        className={inputCls}
        placeholder={
          field === "priceMin" || field === "priceMax" ? "e.g. 500000" : "e.g. 30"
        }
      />
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const canSave = name.trim().length > 0 && conditions.length > 0 && !saving;

  return (
    <div className={`fixed inset-0 z-50 flex justify-end${open ? "" : " hidden"}`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative flex h-full w-96 flex-col overflow-y-auto bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/10 px-6 py-4">
          <h2 className="font-sans text-lg font-light text-[#1B1B1B]">
            {initial ? "Edit List" : "New Smart List"}
          </h2>
          <button
            onClick={onClose}
            className="font-sans text-xl leading-none text-[#1B1B1B]/30 hover:text-[#1B1B1B]"
            aria-label="Close drawer"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 p-6">
          {/* Name */}
          <div>
            <label className="mb-1 block font-sans text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/40">
              List Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Buyers in Irvine"
              className="w-full rounded border border-[#1B1B1B]/10 bg-white px-3 py-2 font-sans text-sm text-[#1B1B1B] focus:outline-none focus:ring-1 focus:ring-[#9E8C61]"
            />
          </div>

          {/* Conditions */}
          <div>
            <label className="mb-2 block font-sans text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/40">
              Filters{" "}
              <span className="normal-case text-[#1B1B1B]/30">(all must match)</span>
            </label>

            <div className="space-y-3">
              {conditions.map((c, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-lg border border-[#1B1B1B]/10 p-3"
                >
                  {/* Field selector + remove */}
                  <div className="flex items-center gap-2">
                    <select
                      value={c.field}
                      onChange={e => updateField(i, e.target.value)}
                      className={`flex-1 ${selectCls}`}
                    >
                      {FIELDS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeCondition(i)}
                      className="flex-shrink-0 font-sans text-lg leading-none text-[#1B1B1B]/30 hover:text-red-500"
                      aria-label="Remove condition"
                    >
                      ×
                    </button>
                  </div>

                  {/* Operator selector (hidden when only one option) */}
                  {(FIELD_OPERATORS[c.field]?.length ?? 0) > 1 && (
                    <select
                      value={c.operator}
                      onChange={e => updateOperator(i, e.target.value)}
                      className={selectCls}
                    >
                      {FIELD_OPERATORS[c.field].map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                  )}

                  {/* Value input */}
                  {renderValueInput(c, i)}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addCondition}
              className="mt-3 w-full rounded-lg border border-dashed border-[#1B1B1B]/20 px-3 py-2 font-sans text-sm text-[#1B1B1B]/40 hover:border-[#9E8C61]/40 hover:text-[#9E8C61]"
            >
              + Add Filter
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="space-y-3 border-t border-[#1B1B1B]/10 p-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="w-full rounded-lg bg-[#1B1B1B] px-4 py-2 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-30"
          >
            {saving ? "Saving…" : initial ? "Save Changes" : "Create List"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-[#1B1B1B]/10 px-4 py-2 font-sans text-sm text-[#1B1B1B]/60 hover:bg-[#F2F0EF]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
