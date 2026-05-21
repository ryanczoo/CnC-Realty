"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { LEAD_STATUS_COLORS } from "@/lib/campaign-ui";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

interface RecipientPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function RecipientPicker({ selectedIds, onChange }: RecipientPickerProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/leads", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setLeads(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name !== "AbortError") setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.firstName.toLowerCase().includes(q) ||
      l.lastName.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q)
    );
  });

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  const toggleAll = () => {
    const allFilteredIds = filtered.map((l) => l.id);
    const allSelected = allFilteredIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      onChange(selectedIds.filter((id) => !allFilteredIds.includes(id)));
    } else {
      const combined = Array.from(new Set([...selectedIds, ...allFilteredIds]));
      onChange(combined);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-sans text-sm font-medium text-[#1B1B1B]">
          {selectedIds.length > 0
            ? `${selectedIds.length} recipient${selectedIds.length > 1 ? "s" : ""} selected`
            : "No recipients selected"}
        </p>
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-[#9E8C61] hover:underline"
          >
            {filtered.every((l) => selectedIds.includes(l.id)) ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1B1B1B]/40" />
        <input
          type="text"
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] py-2 pl-9 pr-3 font-sans text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/40 outline-none focus:border-[#9E8C61]"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-[#F2F0EF]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center font-sans text-sm text-[#1B1B1B]/40">
          {search ? "No leads match your search." : "No leads yet."}
        </p>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-[#1B1B1B]/10 bg-white">
          {filtered.map((lead) => (
            <label
              key={lead.id}
              className="flex cursor-pointer items-center gap-3 border-b border-[#1B1B1B]/5 px-4 py-3 last:border-0 hover:bg-[#F2F0EF]"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(lead.id)}
                onChange={() => toggle(lead.id)}
                className="h-4 w-4 rounded accent-[#9E8C61]"
              />
              <div className="flex-1 min-w-0">
                <p className="font-sans text-sm font-medium text-[#1B1B1B] truncate">
                  {lead.firstName} {lead.lastName}
                </p>
                <p className="font-sans text-xs text-[#1B1B1B]/50 truncate">{lead.email}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  LEAD_STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-500"
                }`}
              >
                {lead.status.replace(/_/g, " ")}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
