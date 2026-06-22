"use client";

import { useState } from "react";

export function AgentTitleEditor({ agentId, currentTitle }: { agentId: string; currentTitle: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentTitle ?? "Real Estate Agent");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value.trim() }),
      });
      if (res.ok) setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded px-2 py-1 text-xs text-[#1B1B1B]/50 transition-colors hover:bg-[#F2F0EF] hover:text-[#1B1B1B]"
      >
        {value}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="rounded border border-[#9E8C61]/40 px-2 py-1 text-xs text-[#1B1B1B] outline-none focus:border-[#9E8C61] w-44"
      />
      <button
        onClick={save}
        disabled={saving}
        className="rounded bg-[#9E8C61] px-2 py-1 text-xs text-white disabled:opacity-40"
      >
        {saving ? "…" : "Save"}
      </button>
      <button
        onClick={() => setEditing(false)}
        className="rounded px-2 py-1 text-xs text-[#1B1B1B]/40 hover:text-[#1B1B1B]"
      >
        ✕
      </button>
    </div>
  );
}
