"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { fetchOpenTasks, fetchCompletedTasks, removeTaskById } from "@/lib/dashboard-queries";

export const dynamic = "force-dynamic";

type CrossLeadTask = {
  id: string;
  leadId: string;
  leadFirstName: string;
  leadLastName: string;
  title: string;
  taskType: string;
  notes: string | null;
  dueDate: string | null;
  done: boolean;
  completedAt: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  FOLLOW_UP: "Follow Up", CALL: "Call", EMAIL: "Email", TEXT: "Text",
  SHOWING: "Showing", THANK_YOU: "Thank You", OTHER: "Other",
};

function formatDue(dueDate: string | null): string {
  if (!dueDate) return "—";
  return new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TaskRow({ task, onCheck }: { task: CrossLeadTask; onCheck: (task: CrossLeadTask) => void }) {
  const leadName = `${task.leadFirstName} ${task.leadLastName}`.trim();
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[#F2F0EF] px-3 py-2">
      <input
        type="checkbox"
        checked={false}
        onChange={() => onCheck(task)}
        className="h-4 w-4 accent-[#9E8C61]"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-[#1B1B1B]">{task.title}</p>
        <p className="text-xs text-[#1B1B1B]/40">
          {TYPE_LABELS[task.taskType] ?? task.taskType}
          {" · "}
          <Link href={`/dashboard/leads/${task.leadId}`} className="hover:text-[#9E8C61] hover:underline" onClick={(e) => e.stopPropagation()}>
            {leadName || "Unknown Lead"}
          </Link>
        </p>
      </div>
      <span className="shrink-0 text-xs text-[#1B1B1B]/40">{formatDue(task.dueDate)}</span>
    </div>
  );
}

export default function TasksDashboardPage() {
  const queryClient = useQueryClient();
  const [completedExpanded, setCompletedExpanded] = useState(false);

  const {
    data: tasks = [],
    isLoading: loading,
    isError: hasError,
  } = useQuery<CrossLeadTask[]>({ queryKey: ["tasks", "open"], queryFn: fetchOpenTasks });
  const error = hasError ? "Failed to load tasks. Please refresh." : null;

  const {
    data: completedTasks = [],
    isLoading: completedLoading,
    isError: completedHasError,
  } = useQuery<CrossLeadTask[]>({
    queryKey: ["tasks", "completed"],
    queryFn: fetchCompletedTasks,
    enabled: completedExpanded,
  });
  const completedError = completedHasError ? "Failed to load completed tasks." : null;
  const completedLoaded = completedExpanded && !completedLoading;

  function loadCompleted() {
    setCompletedExpanded(true);
  }

  async function checkOff(task: CrossLeadTask) {
    // Optimistic removal from open list
    queryClient.setQueryData<CrossLeadTask[]>(["tasks", "open"], (prev) => removeTaskById(prev, task.id));
    try {
      await fetch(`/api/leads/${task.leadId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true, completedAt: new Date().toISOString() }),
      });
    } catch {
      // No snap-back — consistent with spec intent; task disappearing is correct behavior
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < today);
  const dueToday = tasks.filter((t) => t.dueDate && new Date(t.dueDate) >= today && new Date(t.dueDate) < tomorrow);
  const upcoming = tasks.filter((t) => !t.dueDate || new Date(t.dueDate) >= tomorrow);

  const allEmpty = !loading && tasks.length === 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="mb-6">
        <h1 className="font-sans text-2xl font-medium text-[#1B1B1B]">Tasks</h1>
        <p className="mt-1 font-sans text-sm text-[#1B1B1B]/50">Follow-up on these open tasks</p>
      </div>

      {loading && <Loader2 className="h-6 w-6 animate-spin text-[#9E8C61]" />}

      {error && (
        <p className="text-center text-sm text-red-500 mt-8">{error}</p>
      )}

      {allEmpty && (
        <p className="text-center text-sm text-[#1B1B1B]/40">You&apos;re all caught up.</p>
      )}

      {overdue.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-medium text-red-500">Overdue</p>
          <div className="space-y-1">{overdue.map((t) => <TaskRow key={t.id} task={t} onCheck={checkOff} />)}</div>
        </section>
      )}

      {dueToday.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-medium text-amber-600">Due Today</p>
          <div className="space-y-1">{dueToday.map((t) => <TaskRow key={t.id} task={t} onCheck={checkOff} />)}</div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-medium text-[#1B1B1B]/40">Upcoming</p>
          <div className="space-y-1">{upcoming.map((t) => <TaskRow key={t.id} task={t} onCheck={checkOff} />)}</div>
        </section>
      )}

      {/* Completed — lazy loaded on expand */}
      <details onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) loadCompleted(); }}>
        <summary className="cursor-pointer text-xs text-[#1B1B1B]/40">Completed tasks</summary>
        <div className="mt-2 space-y-1">
          {completedLoading && <Loader2 className="h-6 w-6 animate-spin text-[#9E8C61]" />}
          {completedError && (
            <p className="text-sm text-red-500 mt-2">{completedError}</p>
          )}
          {completedLoaded && completedTasks.length === 0 && (
            <p className="text-sm text-[#1B1B1B]/40">No completed tasks.</p>
          )}
          {completedTasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg bg-[#F2F0EF] px-3 py-2 opacity-50">
              <input type="checkbox" checked disabled className="h-4 w-4 accent-[#9E8C61]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm line-through text-[#1B1B1B]/60">{t.title}</p>
                <p className="text-xs text-[#1B1B1B]/30">
                  {TYPE_LABELS[t.taskType] ?? t.taskType}
                  {" · "}
                  <Link href={`/dashboard/leads/${t.leadId}`} className="hover:underline">
                    {`${t.leadFirstName} ${t.leadLastName}`.trim()}
                  </Link>
                </p>
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
