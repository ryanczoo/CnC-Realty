"use client";

import { useState } from "react";

type LinkedLead = { id: string; firstName: string; lastName: string; email: string };
type Relationship = { id: string; type: string; lead: LinkedLead };

interface Props {
  leadId: string;
  relationships: Relationship[];
  onChanged: () => void;
}

const REL_TYPES = ["SPOUSE","PARTNER","FAMILY","REFERRAL"] as const;

export function RelationshipSection({ leadId, relationships, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkedLead[]>([]);
  const [selected, setSelected] = useState<LinkedLead | null>(null);
  const [type, setType] = useState<string>("SPOUSE");

  async function search(q: string) {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    const res = await fetch(`/api/leads?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setResults((Array.isArray(data) ? data : []).filter((l: LinkedLead) => l.id !== leadId).slice(0, 8));
  }

  async function save() {
    if (!selected) return;
    await fetch(`/api/leads/${leadId}/relationships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toLeadId: selected.id, type }),
    });
    setOpen(false);
    setSelected(null);
    setQuery("");
    onChanged();
  }

  async function remove(relId: string) {
    await fetch(`/api/leads/${leadId}/relationships/${relId}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Relationships</p>
      <div className="space-y-1.5">
        {relationships.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg bg-[#F2F0EF] px-3 py-2">
            <div>
              <p className="text-sm font-medium text-[#1B1B1B]">{r.lead.firstName} {r.lead.lastName}</p>
              <p className="text-xs text-[#1B1B1B]/50">{r.type.charAt(0) + r.type.slice(1).toLowerCase()}</p>
            </div>
            <button onClick={() => remove(r.id)} className="text-xs text-[#1B1B1B]/30 hover:text-red-500">Remove</button>
          </div>
        ))}
      </div>
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-[#9E8C61] hover:underline"
      >
        + Link Contact
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 font-sans text-lg font-light text-[#1B1B1B]">Link a Contact</h3>
            <input
              autoFocus
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
            />
            {results.length > 0 && !selected && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[#1B1B1B]/10">
                {results.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => { setSelected(l); setQuery(`${l.firstName} ${l.lastName}`); }}
                    className="flex w-full flex-col px-3 py-2 text-left hover:bg-[#F2F0EF]"
                  >
                    <span className="text-sm font-medium">{l.firstName} {l.lastName}</span>
                    <span className="text-xs text-[#1B1B1B]/50">{l.email}</span>
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <div className="mt-3">
                <label className="mb-1 block text-xs text-[#1B1B1B]/50">Relationship type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm"
                >
                  {REL_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => { setOpen(false); setSelected(null); setQuery(""); }} className="flex-1 rounded-lg border border-[#1B1B1B]/10 py-2 text-sm">Cancel</button>
              <button onClick={save} disabled={!selected} className="flex-1 rounded-lg bg-[#1B1B1B] py-2 text-sm font-medium text-white disabled:opacity-40">Link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
