"use client";
import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";

interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  order: number;
  isRequired: boolean;
}

interface Props {
  templateId: string;
  items: TemplateItem[];
  onChanged: () => void;
}

export function ChecklistTemplateEditor({ templateId, items, onChanged }: Props) {
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", description: "", isRequired: true });

  async function addItem() {
    if (!newItem.name.trim()) return;
    await fetch(`/api/admin/checklist-templates/${templateId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newItem, order: items.length + 1 }),
    });
    setNewItem({ name: "", description: "", isRequired: true });
    setAdding(false);
    onChanged();
  }

  async function deleteItem(itemId: string) {
    await fetch(`/api/admin/checklist-templates/${templateId}/items/${itemId}`, { method: "DELETE" });
    onChanged();
  }

  async function toggleRequired(itemId: string, current: boolean) {
    await fetch(`/api/admin/checklist-templates/${templateId}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRequired: !current }),
    });
    onChanged();
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2.5">
          <GripVertical className="h-4 w-4 shrink-0 text-[#1B1B1B]/20" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[#1B1B1B]">{item.name}</p>
            {item.description && <p className="text-xs text-[#1B1B1B]/50">{item.description}</p>}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-[#1B1B1B]/50">
            <input type="checkbox" checked={item.isRequired} onChange={() => toggleRequired(item.id, item.isRequired)} className="h-3.5 w-3.5 rounded" />
            Required
          </label>
          <button onClick={() => deleteItem(item.id)} className="text-[#1B1B1B]/30 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="rounded-lg border border-[#1B1B1B]/10 p-3 space-y-2">
          <input value={newItem.name} onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))} placeholder="Document name" className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm" />
          <input value={newItem.description} onChange={(e) => setNewItem((n) => ({ ...n, description: e.target.value }))} placeholder="Description (optional)" className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-[#1B1B1B]/60">
              <input type="checkbox" checked={newItem.isRequired} onChange={(e) => setNewItem((n) => ({ ...n, isRequired: e.target.checked }))} /> Required
            </label>
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="text-sm text-[#1B1B1B]/50">Cancel</button>
              <button onClick={addItem} className="rounded-full bg-[#1B1B1B] px-4 py-1.5 text-sm text-white">Add</button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm text-[#1B1B1B]/50 hover:text-[#1B1B1B]">
          <Plus className="h-4 w-4" /> Add Item
        </button>
      )}
    </div>
  );
}
