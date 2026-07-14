"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { ChecklistTemplateEditor } from "@/components/transactions/ChecklistTemplateEditor";

export default function ChecklistTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFileType, setNewFileType] = useState("LISTING");
  const [newListingType, setNewListingType] = useState("RESIDENTIAL_SALE");
  const [newSide, setNewSide] = useState<string>("");

  async function load() {
    const res = await fetch("/api/admin/checklist-templates");
    const data = await res.json();
    setTemplates(data.templates ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createTemplate() {
    if (!newName.trim()) return;
    await fetch("/api/admin/checklist-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        fileType: newFileType,
        listingType: newListingType || undefined,
        transactionSide: newSide || undefined,
      }),
    });
    setNewName("");
    setNewFileType("LISTING");
    setNewListingType("RESIDENTIAL_SALE");
    setNewSide("");
    setCreating(false);
    load();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/admin/checklist-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-light text-[#1B1B1B]">Checklist Templates</h1>
        <button
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-[#1B1B1B] px-4 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      {creating && (
        <div className="mb-6 rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-4">
          <h2 className="text-sm font-medium text-[#1B1B1B]">New Template</h2>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">Template Name *</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Residential Sale — Buyer Side"
              className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">File Type *</label>
            <select value={newFileType} onChange={(e) => setNewFileType(e.target.value)} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm">
              <option value="LISTING">Listing File (pre-contract, matched by Listing Type)</option>
              <option value="TRANSACTION">Transaction File (matched by Transaction Side)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">Listing Type</label>
              <select value={newListingType} onChange={(e) => setNewListingType(e.target.value)} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm">
                <option value="">Any</option>
                <option value="RESIDENTIAL_SALE">Residential Sale</option>
                <option value="RESIDENTIAL_LEASE">Residential Lease</option>
                <option value="COMMERCIAL">Commercial</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#1B1B1B]/60">Transaction Side</label>
              <select value={newSide} onChange={(e) => setNewSide(e.target.value)} className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm">
                <option value="">Any</option>
                <option value="PURCHASE">Purchase</option>
                <option value="LISTING">Listing</option>
                <option value="DUAL">Dual Agency</option>
                <option value="LEASE_TENANT">Lease Tenant</option>
                <option value="LEASE_LANDLORD">Lease Landlord</option>
                <option value="LEASE_DUAL">Lease Dual Agency</option>
                <option value="REFERRAL">Referral</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="text-sm text-[#1B1B1B]/50">Cancel</button>
            <button onClick={createTemplate} className="rounded-full bg-[#1B1B1B] px-4 py-1.5 text-sm text-white">Create</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-[#F2F0EF]" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1B1B1B]/20 py-16 text-center">
          <p className="text-[#1B1B1B]/40">No templates yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-[#1B1B1B]/10 bg-white">
              <div
                className="flex cursor-pointer items-center justify-between p-4"
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
              >
                <div>
                  <p className="font-medium text-[#1B1B1B]">{t.name}</p>
                  <p className="text-xs text-[#1B1B1B]/40">
                    {t.listingType?.replace(/_/g, " ") ?? "Any type"}
                    {t.transactionSide ? ` · ${t.transactionSide.replace(/_/g, " ")}` : ""}
                    {" · "}
                    {t.items?.length ?? 0} items
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-[#1B1B1B]/50" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={t.isActive}
                      onChange={() => toggleActive(t.id, t.isActive)}
                      className="h-3.5 w-3.5"
                    />
                    Active
                  </label>
                  <span className="text-[#1B1B1B]/30">{expanded === t.id ? "▲" : "▼"}</span>
                </div>
              </div>

              {expanded === t.id && (
                <div className="border-t border-[#1B1B1B]/5 p-4">
                  <ChecklistTemplateEditor
                    templateId={t.id}
                    items={t.items ?? []}
                    onChanged={load}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
