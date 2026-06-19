"use client";

import { useState } from "react";
import { LeadTaskDrawer } from "./LeadTaskDrawer";

type LeadTask = {
  id: string;
  leadId?: string;
  title: string;
  taskType: string;
  dueDate: string | null;
  notes: string | null;
  done: boolean;
  completedAt: string | null;
  createdAt?: string;
};

const TASK_TYPES = ["FOLLOW_UP","CALL","EMAIL","TEXT","SHOWING","THANK_YOU","OTHER"] as const;
const TYPE_LABELS: Record<string, string> = {
  FOLLOW_UP: "Follow Up", CALL: "Call", EMAIL: "Email", TEXT: "Text",
  SHOWING: "Showing", THANK_YOU: "Thank You", OTHER: "Other",
};

interface Props {
  leadId: string;
  initialTasks: LeadTask[];
}

export function LeadTasksTab({ leadId, initialTasks }: Props) {
  const [tasks, setTasks] = useState<LeadTask[]>(initialTasks);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<string>("FOLLOW_UP");
  const [newDate, setNewDate] = useState("");
  const [creating, setCreating] = useState(false);

  const [selectedTask, setSelectedTask] = useState<LeadTask | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdue = tasks.filter((t) => !t.done && t.dueDate && new Date(t.dueDate) < today);
  const dueToday = tasks.filter((t) => !t.done && t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString());
  const upcoming = tasks.filter((t) => !t.done && (!t.dueDate || new Date(t.dueDate) > today) && !dueToday.includes(t));
  const completed = tasks.filter((t) => t.done);

  async function quickTask(daysFromNow: number) {
    if (creating) return;
    setCreating(true);
    try {
      const due = new Date();
      due.setDate(due.getDate() + daysFromNow);
      const res = await fetch(`/api/leads/${leadId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Follow Up", taskType: "FOLLOW_UP", dueDate: due.toISOString() }),
      });
      if (!res.ok) return;
      const task = await res.json();
      setTasks((prev) => [{ ...task, notes: null }, ...prev]);
    } finally {
      setCreating(false);
    }
  }

  async function toggleDone(task: LeadTask) {
    try {
      const res = await fetch(`/api/leads/${leadId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !task.done }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...updated, notes: updated.notes ?? null } : t)));
    } catch {
      // network error — leave state unchanged
    }
  }

  async function createTask() {
    try {
      const res = await fetch(`/api/leads/${leadId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, taskType: newType, dueDate: newDate ? new Date(newDate).toISOString() : null }),
      });
      if (!res.ok) return;
      const task = await res.json();
      setTasks((prev) => [{ ...task, notes: null }, ...prev]);
      setNewTaskOpen(false);
      setNewTitle("");
      setNewType("FOLLOW_UP");
      setNewDate("");
    } catch {
      // network error — leave drawer open so user can retry
    }
  }

  function openEdit(task: LeadTask) {
    setSelectedTask(task);
    setEditDrawerOpen(true);
  }

  function TaskRow({ task, accent }: { task: LeadTask; accent?: string }) {
    return (
      <div
        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${accent ?? "bg-[#F2F0EF]"} hover:brightness-95`}
        onClick={() => openEdit(task)}
      >
        <input
          type="checkbox"
          checked={task.done}
          onChange={(e) => { e.stopPropagation(); toggleDone(task); }}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 accent-[#9E8C61]"
        />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm ${task.done ? "line-through text-[#1B1B1B]/30" : "text-[#1B1B1B]"}`}>{task.title}</p>
          <p className="text-xs text-[#1B1B1B]/40">{TYPE_LABELS[task.taskType]} {task.dueDate ? `· ${new Date(task.dueDate).toLocaleDateString()}` : ""}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick tasks */}
      <div className="flex gap-2">
        <button onClick={() => quickTask(1)} disabled={creating} className="rounded-lg border border-[#1B1B1B]/10 px-3 py-1.5 text-xs hover:border-[#9E8C61] hover:text-[#9E8C61] disabled:opacity-40">Tomorrow</button>
        <button onClick={() => quickTask(3)} disabled={creating} className="rounded-lg border border-[#1B1B1B]/10 px-3 py-1.5 text-xs hover:border-[#9E8C61] hover:text-[#9E8C61] disabled:opacity-40">In 3 Days</button>
        <button onClick={() => quickTask(7)} disabled={creating} className="rounded-lg border border-[#1B1B1B]/10 px-3 py-1.5 text-xs hover:border-[#9E8C61] hover:text-[#9E8C61] disabled:opacity-40">Next Week</button>
        <button onClick={() => setNewTaskOpen(true)} className="ml-auto rounded-lg bg-[#1B1B1B] px-3 py-1.5 text-xs font-medium text-white">+ New Task</button>
      </div>

      {overdue.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-red-500">Overdue</p>
          <div className="space-y-1">{overdue.map((t) => <TaskRow key={t.id} task={t} accent="bg-red-50" />)}</div>
        </div>
      )}
      {dueToday.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-amber-600">Due Today</p>
          <div className="space-y-1">{dueToday.map((t) => <TaskRow key={t.id} task={t} accent="bg-amber-50" />)}</div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-[#1B1B1B]/40">Upcoming</p>
          <div className="space-y-1">{upcoming.map((t) => <TaskRow key={t.id} task={t} />)}</div>
        </div>
      )}
      {completed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-[#1B1B1B]/40">Completed ({completed.length})</summary>
          <div className="mt-1 space-y-1">{completed.map((t) => <TaskRow key={t.id} task={t} />)}</div>
        </details>
      )}
      {tasks.length === 0 && <p className="text-sm text-[#1B1B1B]/40">No tasks yet. Use the quick buttons above.</p>}

      {/* New Task panel */}
      {newTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setNewTaskOpen(false)} />
          <div className="relative w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl sm:m-4">
            <h3 className="mb-4 font-sans text-lg font-light">New Task</h3>
            <div className="space-y-3">
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title" className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm outline-none focus:border-[#9E8C61]" />
              <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm">
                {TASK_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
              <input type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full rounded-lg border border-[#1B1B1B]/10 px-3 py-2 text-sm" />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setNewTaskOpen(false)} className="flex-1 rounded-lg border border-[#1B1B1B]/10 py-2 text-sm">Cancel</button>
              <button onClick={createTask} disabled={!newTitle.trim()} className="flex-1 rounded-lg bg-[#1B1B1B] py-2 text-sm font-medium text-white disabled:opacity-40">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Drawer — always mounted */}
      <LeadTaskDrawer
        open={editDrawerOpen}
        task={selectedTask ? { ...selectedTask, leadId: selectedTask.leadId ?? leadId, createdAt: selectedTask.createdAt ?? "" } : null}
        leadId={leadId}
        onClose={() => setEditDrawerOpen(false)}
        onSaved={(updated) => {
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...updated } : t)));
          setEditDrawerOpen(false);
        }}
        onDeleted={(taskId) => {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
          setEditDrawerOpen(false);
        }}
      />
    </div>
  );
}
