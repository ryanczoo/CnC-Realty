"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { FilePartyRecord, FilePartyRole, FileContextProps } from "@/types/transaction";

const ROLE_LABELS: Record<FilePartyRole, string> = {
  BUYER: "Buyer", SELLER: "Seller", LISTING_AGENT: "Listing Agent",
  BUYERS_AGENT: "Buyer's Agent", CO_AGENT: "Co-Agent",
  TITLE_ESCROW: "Title/Escrow", LENDER: "Lender",
  TRANSACTION_COORDINATOR: "TC", OTHER: "Other",
};

interface Props extends FileContextProps {
  parties: FilePartyRecord[];
  onChanged: () => void;
}

export function PartiesTable({ fileType, fileId, parties, onChanged }: Props) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ role: "BUYER" as FilePartyRole, name: "", email: "", phone: "", company: "", licenseNumber: "" });

  async function addParty() {
    await fetch(`/api/files/${fileType}/${fileId}/parties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setAdding(false);
    setForm({ role: "BUYER", name: "", email: "", phone: "", company: "", licenseNumber: "" });
    onChanged();
  }

  async function removeParty(partyId: string) {
    await fetch(`/api/files/${fileType}/${fileId}/parties/${partyId}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1B1B1B]/10 text-left text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/40">
            <th className="pb-2">Role</th><th className="pb-2">Name</th><th className="pb-2">Email</th><th className="pb-2">Phone</th><th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {parties.map((p) => (
            <tr key={p.id} className="border-b border-[#1B1B1B]/5">
              <td className="py-2 text-[#1B1B1B]/60">{ROLE_LABELS[p.role]}</td>
              <td className="py-2 font-medium text-[#1B1B1B]">{p.name}</td>
              <td className="py-2 text-[#1B1B1B]/60">{p.email ?? "—"}</td>
              <td className="py-2 text-[#1B1B1B]/60">{p.phone ?? "—"}</td>
              <td className="py-2 text-right">
                <button onClick={() => removeParty(p.id)} className="text-[#1B1B1B]/30 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {adding ? (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-[#1B1B1B]/10 p-4">
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as FilePartyRole }))} className="col-span-2 rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm">
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {(["name", "email", "phone", "company", "licenseNumber"] as const).map((field) => (
            <input key={field} placeholder={field.charAt(0).toUpperCase() + field.slice(1)} value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm" />
          ))}
          <div className="col-span-2 flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="rounded-lg px-4 py-2 text-sm text-[#1B1B1B]/50 hover:text-[#1B1B1B]">Cancel</button>
            <button onClick={addParty} className="rounded-lg bg-[#1B1B1B] px-4 py-2 text-sm text-white">Add Party</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-3 flex items-center gap-1.5 text-sm text-[#1B1B1B]/50 hover:text-[#1B1B1B]">
          <Plus className="h-4 w-4" /> Add Party
        </button>
      )}
    </div>
  );
}
