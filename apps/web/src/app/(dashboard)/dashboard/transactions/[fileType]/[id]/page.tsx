"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { StatusBadge } from "@/components/transactions/StatusBadge";
import { ChecklistPanel } from "@/components/transactions/ChecklistPanel";
import { PartiesTable } from "@/components/transactions/PartiesTable";
import { ActivityFeed } from "@/components/transactions/ActivityFeed";
import { TransferPendingPanel } from "@/components/transactions/TransferPendingPanel";
import { OverviewTab } from "@/components/transactions/OverviewTab";
import { CommissionTab } from "@/components/transactions/CommissionTab";
import { DocumentsTab } from "@/components/transactions/DocumentsTab";
import { getChecklistProgress } from "@/lib/transaction-helpers";
import { isFileReadOnlyFor } from "@/lib/file-lock";
import { isPlaceholderAddress } from "@/lib/transfer-placeholder";
import { DateField } from "@/components/ui/DateField";
import type {
  ListingFileDetail,
  TransactionFileDetail,
  FileChecklistItemWithDocs,
  FileDocumentRecord,
  FileTaskRecord,
} from "@/types/transaction";
import { sanitizeCurrencyInput, formatCurrencyDisplay } from "@/lib/form-validation";
import { formatDateOnly, isDateOnlyPast } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";
import { EMAIL_WARNING_TEXT } from "@/lib/file-messages";

type Tab = "overview" | "checklist" | "parties" | "activity" | "commission" | "documents" | "tasks";

const BASE_TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "checklist", label: "Checklist" },
  { key: "commission", label: "Commission" },
  { key: "documents", label: "Documents" },
  { key: "tasks", label: "Tasks" },
  { key: "parties", label: "Parties" },
  { key: "activity", label: "Activity" },
];

// Single source of truth for which tabs a file may show — the Commission tab is
// hidden for listings and referrals (a referral has no real commission to show).
// Both the tab bar and the initial-tab-from-URL resolution below must go through
// this one function so a tab that's hidden from the tab list can never become
// reachable via a raw "?tab=" query param either.
function computeVisibleTabs(isListing: boolean, isReferral: boolean): { key: Tab; label: string }[] {
  return isListing || isReferral ? BASE_TABS.filter((t) => t.key !== "commission") : BASE_TABS;
}

export default function FileDetailPage() {
  const params = useParams<{ fileType: string; id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const { fileType, id } = params;

  const [tab, setTab] = useState<Tab>("overview");
  const [file, setFile] = useState<ListingFileDetail | TransactionFileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<FileTaskRecord[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  // Holds the raw "?tab=" query param until the file has loaded and we actually
  // know whether it's a listing/referral (and therefore know the true visibleTabs
  // for it) — cleared after being applied once so a later load() (e.g. after
  // submitting for review) never stomps on a tab the user has since clicked into.
  const requestedTabRef = useRef<string | null>(null);

  function load() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const endpoint = fileType === "listing" ? `/api/listings/${id}` : `/api/transactions/${id}`;
    fetch(endpoint, { signal: controller.signal })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          const f = data.listing ?? data.transaction;
          setFile(f);
          setTasks(f?.tasks ?? []);
          if (requestedTabRef.current) {
            const requested = requestedTabRef.current;
            requestedTabRef.current = null;
            const isListingLoaded = fileType === "listing";
            const isReferralLoaded = !isListingLoaded && f?.transactionSide === "REFERRAL";
            if (computeVisibleTabs(isListingLoaded, isReferralLoaded).some((t) => t.key === requested)) {
              setTab(requested as Tab);
            }
          }
        }
        setLoading(false);
      })
      .catch((err) => { if (err.name !== "AbortError") setLoading(false); });
  }

  useEffect(() => {
    requestedTabRef.current = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("tab")
      : null;
    load();
    return () => abortRef.current?.abort();
  }, [id, fileType]);

  async function submitForReview() {
    const endpoint = fileType === "listing"
      ? `/api/listings/${id}/submit-review`
      : `/api/transactions/${id}/submit-review`;
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setActionError(body?.error ?? "Couldn't submit this file. Please try again.");
        return;
      }
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function convertToTransaction() {
    setActionError(null);
    const res = await fetch(`/api/listings/${id}/convert`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setActionError(body?.error ?? "Couldn't convert this listing. Please try again.");
      return;
    }
    router.push("/dashboard/transactions");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-[#F2F0EF]" />
        <div className="h-48 animate-pulse rounded-xl bg-[#F2F0EF]" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-[#1B1B1B]/50">File not found</p>
        <Link href="/dashboard/transactions" className="mt-4 rounded-full bg-[#1B1B1B] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-75">
          All Transactions
        </Link>
      </div>
    );
  }

  const isListing = fileType === "listing";
  const listing = isListing ? (file as ListingFileDetail) : null;
  const transaction = !isListing ? (file as TransactionFileDetail) : null;

  const isReferral = !isListing && transaction?.transactionSide === "REFERRAL";
  const isLocked = file.status === "PENDING_TRANSFER";
  const viewerIsAdmin = session?.user?.role === "ADMIN";
  const readOnly = isFileReadOnlyFor(isListing ? "listing" : "transaction", file.status, session?.user?.role ?? "AGENT");
  const viewerIsFileAgent =
    !!transaction && session?.user?.agentId != null && session.user.agentId === transaction.agentId;

  const title = isLocked
    ? "Locked — Pending Transfer"
    : file.propertyAddress
      ? `${file.propertyAddress}, ${file.city ?? ""}, ${file.state} ${file.zip ?? ""}`
      : isReferral
        ? "Referral File"
        : `${file.city ?? ""} ${file.state} ${file.zip ?? ""}`.trim();
  const { satisfied, required } = getChecklistProgress(file.checklistItems as FileChecklistItemWithDocs[]);
  const progressPct = required > 0 ? Math.round((satisfied / required) * 100) : 0;

  // Only show Commission tab for real-property transactions (not listings or referrals)
  const visibleTabs = computeVisibleTabs(isListing, isReferral);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            {!isLocked && file.propertyAddress ? (
              <>
                <h1 className="text-xl font-bold text-[#1B1B1B]">{file.propertyAddress}</h1>
                <p className="text-sm font-bold text-[#1B1B1B]/60">{file.city ?? ""}, {file.state} {file.zip ?? ""}</p>
              </>
            ) : (
              <h1 className="text-xl font-bold text-[#1B1B1B]">{title}</h1>
            )}
            <div className="mt-1 flex items-center gap-3">
              <StatusBadge status={file.status} />
              {file.awaitingReview && (
                <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">Awaiting Review</span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            {isListing && listing?.status === "ACTIVE" && !readOnly && (
              <button onClick={convertToTransaction} className="rounded-full border border-[#1B1B1B]/20 px-4 py-2 text-sm text-[#1B1B1B]/70 hover:border-[#1B1B1B]/40">
                Convert to Transaction
              </button>
            )}
            {isReferral && transaction && (
              <ReferralActions
                transaction={transaction}
                viewerIsAdmin={viewerIsAdmin}
                viewerIsFileAgent={viewerIsFileAgent}
                onDone={load}
              />
            )}
            {!isReferral && !isLocked && !file.awaitingReview && !readOnly && (
              <button onClick={submitForReview} disabled={submitting} className="inline-flex items-center rounded-full bg-[#9E8C61] px-4 py-2 text-sm text-white disabled:opacity-70">
                {submitting ? <><Spinner className="mr-1.5 h-3.5 w-3.5 text-white" />Submitting…</> : "Submit for Review"}
              </button>
            )}
          </div>
        </div>
        {actionError && <p className="mt-2 text-xs text-red-600">{actionError}</p>}
      </div>

      {isLocked && (
        <TransferPendingPanel
          fileType={fileType as "listing" | "transaction"}
          fileId={id}
          checklistItems={file.checklistItems as FileChecklistItemWithDocs[]}
          onUploaded={load}
          initialAddress={isPlaceholderAddress(file.propertyAddress) ? "" : file.propertyAddress ?? ""}
        />
      )}

      {!isLocked && (
      <>
      {readOnly && (
        <p className="mb-4 rounded-lg bg-[#F2F0EF] px-4 py-2 text-sm text-[#1B1B1B]/60">This file is closed.</p>
      )}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-[#F2F0EF] p-1 w-fit max-w-full">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? "bg-white text-[#1B1B1B] shadow-sm" : "text-[#1B1B1B]/50 hover:text-[#1B1B1B]"}`}
          >
            {t.label}
            {t.key === "tasks" && tasks.some((tk) => !tk.done) && (
              <span className="ml-1.5 rounded-full bg-[#1B1B1B]/10 px-1.5 py-0.5 text-xs">{tasks.filter((tk) => !tk.done).length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <OverviewTab
          file={file}
          isListing={isListing}
          listing={listing}
          transaction={transaction}
          progressPct={progressPct}
          satisfied={satisfied}
          required={required}
        />
      )}

      {tab === "commission" && transaction && (
        <CommissionTab transaction={transaction} />
      )}

      {tab === "documents" && (
        <DocumentsTab
          documents={file.documents as FileDocumentRecord[]}
          checklistItems={file.checklistItems as FileChecklistItemWithDocs[]}
        />
      )}

      {tab === "tasks" && (
        <TasksTab
          fileType={fileType}
          fileId={id}
          tasks={tasks}
          onTasksChanged={setTasks}
          readOnly={readOnly}
        />
      )}

      {tab === "checklist" && (
        <ChecklistPanel
          fileType={fileType.toUpperCase() as "LISTING" | "TRANSACTION"}
          fileId={id}
          items={file.checklistItems as FileChecklistItemWithDocs[]}
          onUploaded={load}
          readOnly={readOnly}
        />
      )}

      {tab === "parties" && (
        <PartiesTable
          fileType={fileType as "listing" | "transaction"}
          fileId={id}
          parties={file.parties ?? []}
          onChanged={load}
          readOnly={readOnly}
        />
      )}

      {tab === "activity" && (
        <ActivityFeed
          fileType={fileType as "listing" | "transaction"}
          fileId={id}
          activities={file.activities ?? []}
          onNoteAdded={load}
          readOnly={readOnly}
        />
      )}
      </>
      )}
    </div>
  );
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

function TasksTab({
  fileType,
  fileId,
  tasks,
  onTasksChanged,
  readOnly,
}: {
  fileType: string;
  fileId: string;
  tasks: FileTaskRecord[];
  onTasksChanged: (tasks: FileTaskRecord[]) => void;
  readOnly: boolean;
}) {
  const [form, setForm] = useState({ title: "", dueDate: "", assigneeName: "" });
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/file-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileType, fileId, ...form }),
      });
      if (res.ok) {
        const data = await res.json();
        onTasksChanged([...tasks, data.task]);
        setForm({ title: "", dueDate: "", assigneeName: "" });
        setShowForm(false);
      }
    } finally {
      setAdding(false);
    }
  }

  async function toggleTask(task: FileTaskRecord) {
    const previous = tasks;
    const optimistic = tasks.map((t) => t.id === task.id ? { ...t, done: !t.done } : t);
    onTasksChanged(optimistic);
    const res = await fetch(`/api/file-tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    });
    if (!res.ok) onTasksChanged(previous);
  }

  async function deleteTask(taskId: string) {
    const previous = tasks;
    onTasksChanged(tasks.filter((t) => t.id !== taskId));
    const res = await fetch(`/api/file-tasks/${taskId}`, { method: "DELETE" });
    if (!res.ok) onTasksChanged(previous);
  }

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#1B1B1B]/50">{pending.length} task{pending.length !== 1 ? "s" : ""} remaining</p>
        {!readOnly && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-full bg-[#1B1B1B] px-4 py-2 text-sm text-white hover:bg-[#1B1B1B]/80 transition-colors"
          >
            + Add Task
          </button>
        )}
      </div>

      {showForm && !readOnly && (
        <form onSubmit={addTask} className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">New Task</h3>
          <input
            type="text"
            required
            placeholder="Task title *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full rounded-lg border border-[#1B1B1B]/15 bg-[#F2F0EF] px-3 py-2 text-sm text-[#1B1B1B] outline-none focus:border-[#1B1B1B]/40"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[#1B1B1B]/40">Due Date (optional)</label>
              <DateField value={form.dueDate} onChange={(v) => setForm((f) => ({ ...f, dueDate: v }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#1B1B1B]/40">Assignee (optional)</label>
              <input
                type="text"
                placeholder="Name"
                value={form.assigneeName}
                onChange={(e) => setForm((f) => ({ ...f, assigneeName: e.target.value }))}
                className="w-full rounded-lg border border-[#1B1B1B]/15 bg-[#F2F0EF] px-3 py-2 text-sm text-[#1B1B1B] outline-none focus:border-[#1B1B1B]/40"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding}
              className="rounded-full bg-[#9E8C61] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add Task"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full border border-[#1B1B1B]/15 px-4 py-2 text-sm text-[#1B1B1B]/50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {tasks.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-[#1B1B1B]/15 bg-white p-10 text-center">
          <p className="text-sm text-[#1B1B1B]/40">No tasks yet.</p>
          {!readOnly && <p className="mt-1 text-xs text-[#1B1B1B]/30">Click &quot;Add Task&quot; to create the first one.</p>}
        </div>
      )}

      {pending.length > 0 && (
        <div className="rounded-xl border border-[#1B1B1B]/10 bg-white overflow-hidden">
          {pending.map((task, i) => (
            <TaskRow key={task.id} task={task} isLast={i === pending.length - 1} onToggle={toggleTask} onDelete={deleteTask} readOnly={readOnly} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="rounded-xl border border-[#1B1B1B]/5 bg-white overflow-hidden opacity-60">
          <div className="border-b border-[#1B1B1B]/5 px-5 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/30">Completed ({done.length})</span>
          </div>
          {done.map((task, i) => (
            <TaskRow key={task.id} task={task} isLast={i === done.length - 1} onToggle={toggleTask} onDelete={deleteTask} readOnly={readOnly} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  isLast,
  onToggle,
  onDelete,
  readOnly,
}: {
  task: FileTaskRecord;
  isLast: boolean;
  onToggle: (t: FileTaskRecord) => void;
  onDelete: (id: string) => void;
  readOnly: boolean;
}) {
  const isOverdue = task.dueDate && !task.done && isDateOnlyPast(task.dueDate);

  return (
    <div className={`flex items-center gap-3 px-5 py-3 ${!isLast ? "border-b border-[#1B1B1B]/5" : ""}`}>
      <button
        onClick={() => onToggle(task)}
        disabled={readOnly}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-default ${task.done ? "border-[#9E8C61] bg-[#9E8C61]" : "border-[#1B1B1B]/20 hover:border-[#9E8C61]"}`}
      >
        {task.done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm ${task.done ? "line-through text-[#1B1B1B]/30" : "text-[#1B1B1B]"}`}>{task.title}</p>
        <div className="mt-0.5 flex items-center gap-2">
          {task.dueDate && (
            <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-[#1B1B1B]/40"}`}>
              Due {formatDateOnly(task.dueDate)}
              {isOverdue && " — overdue"}
            </span>
          )}
          {task.assigneeName && (
            <span className="text-xs text-[#1B1B1B]/40">· {task.assigneeName}</span>
          )}
        </div>
      </div>

      {!readOnly && (
        <button
          onClick={() => onDelete(task.id)}
          className="shrink-0 text-[#1B1B1B]/20 hover:text-red-400 transition-colors"
          aria-label="Delete task"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Referral Status Actions ──────────────────────────────────────────────────

function ReferralActions({
  transaction,
  viewerIsAdmin,
  viewerIsFileAgent,
  onDone,
}: {
  transaction: TransactionFileDetail;
  viewerIsAdmin: boolean;
  viewerIsFileAgent: boolean;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState(false);

  async function patch(payload: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    setWarning(false);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Failed to update status. Please try again.");
        return;
      }
      const okBody = await res.json().catch(() => null);
      if (okBody?.emailWarning) setWarning(true);
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  const status = transaction.status;

  let content: React.ReactNode = null;

  if (status === "PENDING" && viewerIsFileAgent) {
    content = (
      <>
        <button
          onClick={() => patch({ status: "REFERRAL_SUCCESSFUL" })}
          disabled={submitting}
          className="rounded-full bg-[#9E8C61] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Referral Successful
        </button>
        <button
          onClick={() => patch({ status: "REFERRAL_UNSUCCESSFUL" })}
          disabled={submitting}
          className="rounded-full border border-[#1B1B1B]/20 px-4 py-2 text-sm text-[#1B1B1B]/70 hover:border-[#1B1B1B]/40 disabled:opacity-50"
        >
          Referral Unsuccessful
        </button>
      </>
    );
  } else if (status === "REFERRAL_SUCCESSFUL" && viewerIsAdmin) {
    content = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!amount.trim()) return;
          patch({ status: "REFERRAL_BROKER_REVIEW", referralAmountReceived: amount });
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          inputMode="decimal"
          required
          placeholder="Amount received"
          value={formatCurrencyDisplay(amount)}
          onChange={(e) => setAmount(sanitizeCurrencyInput(e.target.value, 12))}
          className="w-40 rounded-lg border border-[#1B1B1B]/15 bg-[#F2F0EF] px-3 py-2 text-sm text-[#1B1B1B] outline-none focus:border-[#1B1B1B]/40"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-[#9E8C61] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Submit for Broker Review
        </button>
      </form>
    );
  } else if ((status === "REFERRAL_BROKER_REVIEW" || status === "REFERRAL_UNSUCCESSFUL") && viewerIsAdmin) {
    content = (
      <button
        onClick={() => patch({ status: "CLOSED" })}
        disabled={submitting}
        className="rounded-full bg-[#9E8C61] px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        Mark Closed
      </button>
    );
  }

  if (!content && !warning) return null;

  return (
    <div className="flex flex-col items-end gap-1.5">
      {content && <div className="flex items-center gap-2">{content}</div>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {warning && <p className="mt-2 text-xs text-amber-700">{EMAIL_WARNING_TEXT}</p>}
    </div>
  );
}

