"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/transactions/StatusBadge";
import { ChecklistPanel } from "@/components/transactions/ChecklistPanel";
import { PartiesTable } from "@/components/transactions/PartiesTable";
import { ActivityFeed } from "@/components/transactions/ActivityFeed";
import { getChecklistProgress } from "@/lib/transaction-helpers";
import type {
  ListingFileDetail,
  TransactionFileDetail,
  FileChecklistItemWithDocs,
  FileDocumentRecord,
  FileTaskRecord,
} from "@/types/transaction";
import { TC_FEE, calcNetToAgent } from "@/lib/commission";

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

export default function FileDetailPage() {
  const params = useParams<{ fileType: string; id: string }>();
  const router = useRouter();
  const { fileType, id } = params;

  const [tab, setTab] = useState<Tab>("overview");
  const [file, setFile] = useState<ListingFileDetail | TransactionFileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<FileTaskRecord[]>([]);
  const abortRef = useRef<AbortController | null>(null);

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
        }
        setLoading(false);
      })
      .catch((err) => { if (err.name !== "AbortError") setLoading(false); });
  }

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [id, fileType]);

  async function submitForReview() {
    const endpoint = fileType === "listing"
      ? `/api/listings/${id}/submit-review`
      : `/api/transactions/${id}/submit-review`;
    await fetch(endpoint, { method: "POST" });
    load();
  }

  async function convertToTransaction() {
    await fetch(`/api/listings/${id}/convert`, { method: "POST" });
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
        <p className="text-[#1B1B1B]/50">File not found.</p>
        <Link href="/dashboard/transactions" className="mt-4 text-sm text-[#9E8C61] hover:underline">← Back to transactions</Link>
      </div>
    );
  }

  const isListing = fileType === "listing";
  const listing = isListing ? (file as ListingFileDetail) : null;
  const transaction = !isListing ? (file as TransactionFileDetail) : null;

  const title = `${file.propertyAddress}, ${file.city}, ${file.state} ${file.zip}`;
  const price = isListing
    ? (listing?.listPrice ? `$${Number(listing.listPrice).toLocaleString()}` : null)
    : (transaction?.salePrice ? `$${Number(transaction.salePrice).toLocaleString()}` : null);

  const { satisfied, required } = getChecklistProgress(file.checklistItems as FileChecklistItemWithDocs[]);
  const progressPct = required > 0 ? Math.round((satisfied / required) * 100) : 0;

  // Only show Commission tab for transactions
  const visibleTabs = isListing
    ? BASE_TABS.filter((t) => t.key !== "commission")
    : BASE_TABS;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/dashboard/transactions" className="mb-2 inline-block text-sm text-[#1B1B1B]/40 hover:text-[#1B1B1B]">← Transactions</Link>
            <h1 className="text-xl font-light text-[#1B1B1B]">{title}</h1>
            <div className="mt-1 flex items-center gap-3">
              <StatusBadge status={file.status} />
              {price && <span className="text-sm text-[#1B1B1B]/60">{price}</span>}
              {file.awaitingReview && (
                <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">Awaiting Review</span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            {isListing && listing?.status === "ACTIVE" && (
              <button onClick={convertToTransaction} className="rounded-full border border-[#1B1B1B]/20 px-4 py-2 text-sm text-[#1B1B1B]/70 hover:border-[#1B1B1B]/40">
                Convert to Transaction
              </button>
            )}
            {!file.awaitingReview && (
              <button onClick={submitForReview} className="rounded-full bg-[#9E8C61] px-4 py-2 text-sm text-white">
                Submit for Review
              </button>
            )}
          </div>
        </div>
      </div>

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
        />
      )}

      {tab === "checklist" && (
        <ChecklistPanel
          fileType={fileType.toUpperCase() as "LISTING" | "TRANSACTION"}
          fileId={id}
          items={file.checklistItems as FileChecklistItemWithDocs[]}
          onUploaded={load}
        />
      )}

      {tab === "parties" && (
        <PartiesTable
          fileType={fileType as "listing" | "transaction"}
          fileId={id}
          parties={file.parties ?? []}
          onChanged={load}
        />
      )}

      {tab === "activity" && (
        <ActivityFeed
          fileType={fileType as "listing" | "transaction"}
          fileId={id}
          activities={file.activities ?? []}
          onNoteAdded={load}
        />
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  file, isListing, listing, transaction, progressPct, satisfied, required,
}: {
  file: ListingFileDetail | TransactionFileDetail;
  isListing: boolean;
  listing: ListingFileDetail | null;
  transaction: TransactionFileDetail | null;
  progressPct: number;
  satisfied: number;
  required: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Property Details</h2>
          <InfoRow label="Address" value={file.propertyAddress} />
          <InfoRow label="City" value={file.city} />
          <InfoRow label="State" value={file.state} />
          <InfoRow label="ZIP" value={file.zip} />
          {file.mlsNumber && <InfoRow label="MLS #" value={file.mlsNumber} />}
          {isListing && listing && (
            <>
              <InfoRow label="List Price" value={listing.listPrice ? `$${Number(listing.listPrice).toLocaleString()}` : "—"} />
              <InfoRow label="Type" value={listing.listingType ?? "—"} />
              {listing.listDate && <InfoRow label="List Date" value={new Date(listing.listDate).toLocaleDateString()} />}
              {listing.expirationDate && <InfoRow label="Expiration" value={new Date(listing.expirationDate).toLocaleDateString()} />}
              {listing.commissionPercent && <InfoRow label="Commission" value={`${listing.commissionPercent}%`} />}
            </>
          )}
          {!isListing && transaction && (
            <>
              {transaction.propertyType && <InfoRow label="Property Type" value={transaction.propertyType} />}
              {transaction.yearBuilt && <InfoRow label="Year Built" value={String(transaction.yearBuilt)} />}
              {transaction.escrowNumber && <InfoRow label="Escrow #" value={transaction.escrowNumber} />}
              <InfoRow label="Transaction Side" value={transaction.transactionSide ?? "—"} />
              <InfoRow label="List Price" value={transaction.listPrice ? `$${Number(transaction.listPrice).toLocaleString()}` : "—"} />
              <InfoRow label="Sale Price" value={transaction.salePrice ? `$${Number(transaction.salePrice).toLocaleString()}` : "—"} />
            </>
          )}
        </div>

        {!isListing && transaction && (
          <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Key Dates</h2>
            <InfoRow label="Offer Date" value={transaction.offerDate ? new Date(transaction.offerDate).toLocaleDateString() : "—"} />
            <InfoRow label="Acceptance Date" value={transaction.acceptanceDate ? new Date(transaction.acceptanceDate).toLocaleDateString() : "—"} />
            <InfoRow label="Inspection Deadline" value={transaction.inspectionDeadline ? new Date(transaction.inspectionDeadline).toLocaleDateString() : "—"} />
            <InfoRow label="Appraisal Deadline" value={transaction.appraisalDeadline ? new Date(transaction.appraisalDeadline).toLocaleDateString() : "—"} />
            <InfoRow label="Loan Approval" value={transaction.loanApprovalDeadline ? new Date(transaction.loanApprovalDeadline).toLocaleDateString() : "—"} />
            <InfoRow label="Close of Escrow" value={transaction.closeOfEscrow ? new Date(transaction.closeOfEscrow).toLocaleDateString() : "—"} />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Checklist Progress</h2>
        <div className="flex items-end justify-between">
          <span className="text-2xl font-light text-[#1B1B1B]">{progressPct}%</span>
          <span className="text-sm text-[#1B1B1B]/50">{satisfied} / {required} required</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#F2F0EF]">
          <div className="h-full rounded-full bg-[#9E8C61] transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="text-xs text-[#1B1B1B]/40">Go to the Checklist tab to upload documents.</p>
      </div>
    </div>
  );
}

// ─── Commission Tab ───────────────────────────────────────────────────────────

function CommissionTab({ transaction }: { transaction: TransactionFileDetail }) {
  const salePrice = Number(transaction.salePrice ?? 0);
  const salePct = Number(transaction.saleCommissionPct ?? 0);
  const listingPct = Number(transaction.listingCommissionPct ?? 0);
  const deductions = Number(transaction.otherDeductions ?? 0);

  const saleCommissionDollar = salePrice * (salePct / 100);
  const listingCommissionDollar = salePrice * (listingPct / 100);
  const totalGross = saleCommissionDollar + listingCommissionDollar;
  const netToAgent = calcNetToAgent(totalGross, deductions, transaction.tcFeeEnabled);

  const fmt = (n: number) => n !== 0 ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
  const fmtPct = (n: number) => n !== 0 ? `${n}%` : "—";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Commission Breakdown</h2>
        <InfoRow label="Sale Price" value={salePrice > 0 ? `$${salePrice.toLocaleString()}` : "—"} />
        <InfoRow label="Sale Commission" value={fmtPct(salePct)} />
        <InfoRow label="Sale Commission $" value={fmt(saleCommissionDollar)} />
        <InfoRow label="Listing Commission" value={fmtPct(listingPct)} />
        <InfoRow label="Listing Commission $" value={fmt(listingCommissionDollar)} />
        <InfoRow label="Other Deductions" value={deductions > 0 ? `-${fmt(deductions)}` : "—"} />
        {transaction.tcFeeEnabled && (
          <InfoRow label="CnC TC Service" value={`-${fmt(TC_FEE)}`} />
        )}
      </div>

      <div className="rounded-xl border border-[#1B1B1B]/10 bg-white p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Net to Agent</h2>
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/5 pb-3">
          <span className="text-sm text-[#1B1B1B]/50">Gross Commission</span>
          <span className="font-medium text-[#1B1B1B]">{fmt(totalGross)}</span>
        </div>
        <div className="flex items-center justify-between border-b border-[#1B1B1B]/5 pb-3">
          <span className="text-sm text-[#1B1B1B]/50">Deductions</span>
          <span className="font-medium text-red-500">{deductions > 0 ? `-${fmt(deductions)}` : "—"}</span>
        </div>
        {transaction.tcFeeEnabled && (
          <div className="flex items-center justify-between border-b border-[#1B1B1B]/5 pb-3">
            <span className="text-sm text-[#1B1B1B]/50">CnC TC Service</span>
            <span className="font-medium text-red-500">-{fmt(TC_FEE)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-base font-semibold text-[#1B1B1B]">Net to Agent</span>
          <span className="text-xl font-light text-[#9E8C61]">{fmt(netToAgent)}</span>
        </div>
        {transaction.commissionNotes && (
          <p className="mt-2 text-xs text-[#1B1B1B]/40 border-t border-[#1B1B1B]/5 pt-3">{transaction.commissionNotes}</p>
        )}
      </div>
    </div>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  PENDING_REVIEW: "bg-yellow-100 text-yellow-700",
  NOT_SUBMITTED: "bg-[#F2F0EF] text-[#1B1B1B]/50",
};

const STATUS_LABELS: Record<string, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PENDING_REVIEW: "Pending Review",
  NOT_SUBMITTED: "Not Submitted",
};

function DocumentsTab({
  documents,
  checklistItems,
}: {
  documents: FileDocumentRecord[];
  checklistItems: FileChecklistItemWithDocs[];
}) {
  const itemMap = new Map(checklistItems.map((ci) => [ci.id, ci.name]));

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#1B1B1B]/15 bg-white p-10 text-center">
        <p className="text-sm text-[#1B1B1B]/40">No documents uploaded yet.</p>
        <p className="mt-1 text-xs text-[#1B1B1B]/30">Go to the Checklist tab to upload documents.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1B1B1B]/10 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1B1B1B]/5 bg-[#F2F0EF]/60">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Document</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Checklist Item</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Status</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Uploaded</th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/40">Download</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1B1B1B]/5">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-[#F2F0EF]/30 transition-colors">
              <td className="px-5 py-3 font-medium text-[#1B1B1B]">{doc.name}</td>
              <td className="px-5 py-3 text-[#1B1B1B]/50">
                {doc.checklistItemId ? (itemMap.get(doc.checklistItemId) ?? "—") : "Unattached"}
              </td>
              <td className="px-5 py-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[doc.reviewStatus] ?? ""}`}>
                  {STATUS_LABELS[doc.reviewStatus] ?? doc.reviewStatus}
                </span>
              </td>
              <td className="px-5 py-3 text-[#1B1B1B]/50">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
              <td className="px-5 py-3 text-right">
                <a
                  href={doc.r2Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#9E8C61] hover:underline"
                >
                  Download ↗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

function TasksTab({
  fileType,
  fileId,
  tasks,
  onTasksChanged,
}: {
  fileType: string;
  fileId: string;
  tasks: FileTaskRecord[];
  onTasksChanged: (tasks: FileTaskRecord[]) => void;
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
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-[#1B1B1B] px-4 py-2 text-sm text-white hover:bg-[#1B1B1B]/80 transition-colors"
        >
          + Add Task
        </button>
      </div>

      {showForm && (
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
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="w-full rounded-lg border border-[#1B1B1B]/15 bg-[#F2F0EF] px-3 py-2 text-sm text-[#1B1B1B] outline-none focus:border-[#1B1B1B]/40"
              />
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
          <p className="mt-1 text-xs text-[#1B1B1B]/30">Click &quot;Add Task&quot; to create the first one.</p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="rounded-xl border border-[#1B1B1B]/10 bg-white overflow-hidden">
          {pending.map((task, i) => (
            <TaskRow key={task.id} task={task} isLast={i === pending.length - 1} onToggle={toggleTask} onDelete={deleteTask} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="rounded-xl border border-[#1B1B1B]/5 bg-white overflow-hidden opacity-60">
          <div className="border-b border-[#1B1B1B]/5 px-5 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#1B1B1B]/30">Completed ({done.length})</span>
          </div>
          {done.map((task, i) => (
            <TaskRow key={task.id} task={task} isLast={i === done.length - 1} onToggle={toggleTask} onDelete={deleteTask} />
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
}: {
  task: FileTaskRecord;
  isLast: boolean;
  onToggle: (t: FileTaskRecord) => void;
  onDelete: (id: string) => void;
}) {
  const isOverdue = task.dueDate && !task.done && new Date(task.dueDate) < new Date();

  return (
    <div className={`flex items-center gap-3 px-5 py-3 ${!isLast ? "border-b border-[#1B1B1B]/5" : ""}`}>
      <button
        onClick={() => onToggle(task)}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${task.done ? "border-[#9E8C61] bg-[#9E8C61]" : "border-[#1B1B1B]/20 hover:border-[#9E8C61]"}`}
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
              Due {new Date(task.dueDate).toLocaleDateString()}
              {isOverdue && " — overdue"}
            </span>
          )}
          {task.assigneeName && (
            <span className="text-xs text-[#1B1B1B]/40">· {task.assigneeName}</span>
          )}
        </div>
      </div>

      <button
        onClick={() => onDelete(task.id)}
        className="shrink-0 text-[#1B1B1B]/20 hover:text-red-400 transition-colors"
        aria-label="Delete task"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#1B1B1B]/5 pb-2 text-sm">
      <span className="text-[#1B1B1B]/50">{label}</span>
      <span className="text-right font-medium text-[#1B1B1B]">{value}</span>
    </div>
  );
}
