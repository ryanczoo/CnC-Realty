"use client";

import { useState, useEffect, useRef } from "react";

type Tag = { id: string; name: string; color: string };

interface Props {
  leadId: string;
  applied: Tag[];
  onApplied: (tag: Tag) => void;
  onRemoved: (tagId: string) => void;
}

const PRESET_COLORS = ["#9E8C61","#3B82F6","#22C55E","#EF4444","#A855F7","#F97316","#14B8A6","#6B7280"];

export function TagPicker({ leadId, applied, onApplied, onRemoved }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [creating, setCreating] = useState(false);
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/tags")
      .then((r) => r.json())
      .then((data) => setAllTags(Array.isArray(data) ? data : []));
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const appliedIds = new Set(applied.map((t) => t.id));
  const filtered = allTags.filter(
    (t) => !appliedIds.has(t.id) && t.name.toLowerCase().includes(query.toLowerCase())
  );
  const exactMatch = allTags.some((t) => t.name.toLowerCase() === query.toLowerCase());

  async function applyTag(tag: Tag) {
    await fetch(`/api/leads/${leadId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tag.name, color: tag.color }),
    });
    onApplied(tag);
    setQuery("");
  }

  async function createAndApply() {
    const res = await fetch(`/api/leads/${leadId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: query.trim(), color: newColor }),
    });
    const tag = await res.json();
    onApplied(tag);
    setQuery("");
    setCreating(false);
    setAllTags((prev) => [...prev, tag]);
  }

  async function removeTag(tagId: string) {
    await fetch(`/api/leads/${leadId}/tags/${tagId}`, { method: "DELETE" });
    onRemoved(tagId);
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap gap-1.5">
        {applied.map((tag) => (
          <span
            key={tag.id}
            className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={() => removeTag(tag.id)}
              className="ml-0.5 opacity-70 hover:opacity-100"
              aria-label={`Remove ${tag.name}`}
            >
              ×
            </button>
          </span>
        ))}
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-dashed border-[#1B1B1B]/20 px-2.5 py-0.5 text-xs text-[#1B1B1B]/40 hover:border-[#9E8C61] hover:text-[#9E8C61]"
        >
          + Add Tag
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-[#1B1B1B]/10 bg-white p-2 shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCreating(false); }}
            placeholder="Search or create tag..."
            className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-1.5 text-sm outline-none focus:border-[#9E8C61]"
          />
          <div className="mt-1 max-h-48 overflow-y-auto">
            {filtered.map((tag) => (
              <button
                key={tag.id}
                onClick={() => applyTag(tag)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[#F2F0EF]"
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))}
            {query.trim() && !exactMatch && (
              <button
                onClick={() => setCreating(true)}
                className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-[#9E8C61] hover:bg-[#F2F0EF]"
              >
                Create &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
          {creating && (
            <div className="mt-2 border-t border-[#1B1B1B]/10 pt-2">
              <p className="mb-1.5 text-xs text-[#1B1B1B]/50">Choose color</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className="h-5 w-5 rounded-full"
                    style={{ backgroundColor: c, outline: newColor === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }}
                  />
                ))}
              </div>
              <button
                onClick={createAndApply}
                className="mt-2 w-full rounded-lg bg-[#1B1B1B] py-1.5 text-xs font-medium text-white hover:bg-[#1B1B1B]/80"
              >
                Create tag
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
