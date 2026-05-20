"use client";
import { useState } from "react";
import type { FileActivityRecord, FileActivityType, FileContextProps } from "@/types/transaction";

const TYPE_LABELS: Record<FileActivityType, string> = {
  FILE_CREATED:             "File created",
  STATUS_CHANGED:           "Status changed",
  DOCUMENT_UPLOADED:        "Document uploaded",
  DOCUMENT_APPROVED:        "Document approved",
  DOCUMENT_REJECTED:        "Document rejected",
  SUBMITTED_FOR_REVIEW:     "Submitted for review",
  PARTY_ADDED:              "Party added",
  NOTE_ADDED:               "Note added",
  CONVERTED_TO_TRANSACTION: "Converted to transaction",
};

interface Props extends FileContextProps {
  activities: FileActivityRecord[];
  onNoteAdded: () => void;
}

export function ActivityFeed({ fileType, fileId, activities, onNoteAdded }: Props) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function addNote() {
    if (!note.trim()) return;
    setSaving(true);
    await fetch(`/api/files/${fileType}/${fileId}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setNote("");
    setSaving(false);
    onNoteAdded();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {activities.map((a) => (
          <div key={a.id} className="flex gap-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#9E8C61]" />
            <div className="flex-1">
              <p className="text-sm text-[#1B1B1B]">
                <span className="font-medium">{a.actor.name ?? a.actor.email}</span>
                {" "}
                {TYPE_LABELS[a.type]}
                {a.type === "STATUS_CHANGED" && a.payload && (
                  <span className="text-[#1B1B1B]/50"> · {(a.payload as { from: string; to: string }).from} → {(a.payload as { from: string; to: string }).to}</span>
                )}
              </p>
              {a.note && <p className="mt-0.5 text-sm text-[#1B1B1B]/60">{a.note}</p>}
              <p className="text-xs text-[#1B1B1B]/40">{new Date(a.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[#1B1B1B]/10 pt-4">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note…"
          rows={3}
          className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9E8C61]/30"
        />
        <div className="mt-2 flex justify-end">
          <button onClick={addNote} disabled={saving || !note.trim()} className="rounded-full bg-[#1B1B1B] px-4 py-1.5 text-sm text-white disabled:opacity-40">
            {saving ? "Saving…" : "Add Note"}
          </button>
        </div>
      </div>
    </div>
  );
}
