"use client";

import { useState } from "react";

type Tag = { id: string; name: string; color: string; createdAt: string; leadCount: number };

const PRESET_COLORS = ["#9E8C61","#3B82F6","#22C55E","#EF4444","#A855F7","#F97316","#14B8A6","#6B7280"];

interface Props {
  initialTags: Tag[];
  autoTagCity: boolean;
}

export function AdminTagsClient({ initialTags, autoTagCity: initialAutoTagCity }: Props) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [cityToggle, setCityToggle] = useState(initialAutoTagCity);

  async function createTag() {
    if (!newName.trim()) return;
    const res = await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    });
    const tag = await res.json();
    setTags((prev) => [...prev, { ...tag, leadCount: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/admin/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, color: editColor }),
    });
    const updated = await res.json();
    setTags((prev) => prev.map((t) => (t.id === id ? { ...updated, leadCount: t.leadCount } : t)));
    setEditId(null);
  }

  async function deleteTag(id: string, force = false) {
    const res = await fetch(`/api/admin/tags/${id}${force ? "?force=true" : ""}`, { method: "DELETE" });
    if (res.status === 409) {
      const { count } = await res.json();
      if (window.confirm(`This tag is used by ${count} leads. Force delete and remove from all leads?`)) {
        await deleteTag(id, true);
      }
      return;
    }
    setTags((prev) => prev.filter((t) => t.id !== id));
  }

  async function toggleCityTag(val: boolean) {
    setCityToggle(val);
    await fetch("/api/admin/tags/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "autoTagCity", value: String(val) }),
    });
  }

  return (
    <div className="space-y-6">
      {/* City auto-tag toggle */}
      <div className="flex items-center justify-between rounded-2xl bg-white p-5">
        <div>
          <p className="font-sans text-sm font-medium text-[#1B1B1B]">Auto-tag leads with city of property inquiry</p>
          <p className="text-xs text-[#1B1B1B]/50">When a lead inquires about a property, their city is applied as a tag</p>
        </div>
        <button
          onClick={() => toggleCityTag(!cityToggle)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cityToggle ? "bg-[#9E8C61]" : "bg-[#1B1B1B]/20"}`}
          aria-label={cityToggle ? "Disable auto-tag by city" : "Enable auto-tag by city"}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${cityToggle ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {/* Create tag */}
      <div className="rounded-2xl bg-white p-5">
        <p className="mb-3 font-sans text-sm font-medium text-[#1B1B1B]">Create Tag</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTag()}
            placeholder="Tag name"
            className="flex-1 rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
          />
          <div className="flex gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="h-8 w-8 rounded-full"
                style={{ backgroundColor: c, outline: newColor === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
          <button onClick={createTag} className="rounded-lg bg-[#1B1B1B] px-4 py-2 text-sm font-medium text-white">Create</button>
        </div>
      </div>

      {/* Tags table */}
      <div className="rounded-2xl bg-white">
        {tags.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#1B1B1B]/40">No tags yet. Create one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1B1B1B]/10">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Color</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Leads</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr key={tag.id} className="border-b border-[#1B1B1B]/5 last:border-0">
                  <td className="px-5 py-3">
                    {editId === tag.id ? (
                      <div className="flex gap-1">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setEditColor(c)}
                            className="h-5 w-5 rounded-full"
                            style={{ backgroundColor: c, outline: editColor === c ? `2px solid ${c}` : "none", outlineOffset: "1px" }}
                            aria-label={`Select color ${c}`}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: tag.color }} />
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {editId === tag.id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(tag.id)}
                        className="rounded-lg border border-[#9E8C61] px-2 py-1 text-sm outline-none"
                      />
                    ) : (
                      <span className="font-medium text-[#1B1B1B]">{tag.name}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[#1B1B1B]/50">{tag.leadCount}</td>
                  <td className="px-5 py-3 text-right">
                    {editId === tag.id ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditId(null)} className="text-xs text-[#1B1B1B]/40 hover:text-[#1B1B1B]">Cancel</button>
                        <button onClick={() => saveEdit(tag.id)} className="text-xs font-medium text-[#9E8C61]">Save</button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => { setEditId(tag.id); setEditName(tag.name); setEditColor(tag.color); }}
                          className="text-xs text-[#1B1B1B]/50 hover:text-[#1B1B1B]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTag(tag.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
