"use client";

import { useEffect, useState } from "react";
import { PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";

const TASK_TYPES = ["FOLLOW_UP","CALL","EMAIL","TEXT","SHOWING","THANK_YOU","OTHER"] as const;
const TYPE_LABELS: Record<string, string> = {
  FOLLOW_UP: "Follow Up", CALL: "Call", EMAIL: "Email", TEXT: "Text",
  SHOWING: "Showing", THANK_YOU: "Thank You", OTHER: "Other",
};

type LeadTaskRow = {
  id: string;
  leadId: string;
  title: string;
  taskType: string;
  notes: string | null;
  dueDate: string | null;
  done: boolean;
  completedAt: string | null;
  createdAt: string;
};

type Props = {
  open: boolean;
  task: LeadTaskRow | null;
  leadId: string;
  onClose: () => void;
  onSaved: (task: LeadTaskRow) => void;
  onDeleted: (taskId: string) => void;
};

export function LeadTaskDrawer({ open, task, leadId, onClose, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("FOLLOW_UP");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setTaskType(task.taskType);
      setDueDate(task.dueDate ? task.dueDate.slice(0, 16) : "");
      setNotes(task.notes ?? "");
      setError(null);
    }
  }, [task]);

  async function handleSave() {
    if (!task || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          taskType,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to save");
        return;
      }
      const updated: LeadTaskRow = await res.json();
      onSaved(updated);
      onClose();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    if (!window.confirm("Delete this task?")) return;
    try {
      const res = await fetch(`/api/leads/${leadId}/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to delete");
        return;
      }
      onDeleted(task.id);
      onClose();
    } catch {
      setError("Network error — please try again");
    }
  }

  return (
    <div className={open ? "" : "hidden"} role="dialog" aria-modal="true" aria-label="Edit Task">
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-label="Close" />
      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/10 px-6 py-4">
          <h2 className="font-sans text-lg font-light text-[#1B1B1B]">Edit Task</h2>
          <button onClick={onClose} className="text-[#1B1B1B]/40 hover:text-[#1B1B1B]" aria-label="Close">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]"
              placeholder="Task title"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Type</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm"
            >
              {TASK_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Due Date</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#1B1B1B]/50">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="e.g. Left voicemail, mentioned price drop…"
              className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61] resize-none"
            />
          </div>
        </div>

        <div className="border-t border-[#1B1B1B]/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
            >
              Delete
            </button>
            <div className="flex-1" />
            <button onClick={onClose} className="rounded-lg border border-[#1B1B1B]/10 px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className={`rounded-lg bg-[#1B1B1B] px-4 py-2 text-sm font-medium text-white disabled:opacity-40 ${PULSE_ANIMATE} ${PULSE_TRANSITION}`}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
