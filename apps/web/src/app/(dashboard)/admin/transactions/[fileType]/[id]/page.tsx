"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/transactions/StatusBadge";
import { DocumentReviewCard } from "@/components/transactions/DocumentReviewCard";
import { ActivityFeed } from "@/components/transactions/ActivityFeed";
import { PartiesTable } from "@/components/transactions/PartiesTable";
import { OverviewTab } from "@/components/transactions/OverviewTab";
import { CommissionTab } from "@/components/transactions/CommissionTab";
import { DocumentsTab } from "@/components/transactions/DocumentsTab";
import { getChecklistProgress, allowedNextStatuses } from "@/lib/transaction-helpers";
import type { FileDocumentRecord, FileChecklistItemWithDocs, ListingFileDetail, TransactionFileDetail } from "@/types/transaction";
import { EMAIL_WARNING_TEXT } from "@/lib/file-messages";

type Tab = "overview" | "checklist" | "commission" | "documents" | "parties" | "activity";

export default function AdminFileDetailPage() {
  const { fileType, id } = useParams<{ fileType: string; id: string }>();
  const [tab, setTab] = useState<Tab>("overview");
  const [file, setFile] = useState<ListingFileDetail | TransactionFileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState(false);

  async function load() {
    const endpoint = fileType === "listing" ? `/api/listings/${id}` : `/api/transactions/${id}`;
    const res = await fetch(endpoint);
    if (res.ok) {
      const data = await res.json();
      setFile(data.listing ?? data.transaction);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id, fileType]);

  async function changeStatus(newStatus: string) {
    setStatusLoading(true);
    setActionError(null);
    setEmailWarning(false);
    try {
      const res = await fetch(`/api/admin/files/${fileType}/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setActionError(body?.error ?? "Couldn't change the status. Please try again.");
        return;
      }
      if (body?.emailWarning) setEmailWarning(true);
      await load();
    } finally {
      setStatusLoading(false);
    }
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-[#F2F0EF]" />;
  }

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-[#1B1B1B]/50">File not found</p>
        <Link href="/admin/transactions" className="mt-4 rounded-full bg-[#1B1B1B] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-75">
          All Transactions
        </Link>
      </div>
    );
  }

  const isListing = fileType === "listing";
  const listing = isListing ? (file as ListingFileDetail) : null;
  const transaction = !isListing ? (file as TransactionFileDetail) : null;
  const isReferralFile = !isListing && transaction?.transactionSide === "REFERRAL";

  const pendingCount = (file.checklistItems ?? []).reduce(
    (n, item) => n + ((item.documents ?? []) as FileDocumentRecord[]).filter((d) => d.reviewStatus === "PENDING_REVIEW").length,
    0
  );
  const kind = fileType === "listing" ? "listing" : "transaction";
  // Only offer moves the server will accept. The tables also hold the referral
  // steps, which make no sense on an ordinary file, so hide those unless this
  // really is a referral.
  const statuses = [
    file.status as string,
    ...allowedNextStatuses(kind, file.status, "ADMIN").filter((s) => isReferralFile || !s.startsWith("REFERRAL_")),
  ];
  const { satisfied, required } = getChecklistProgress(file.checklistItems as FileChecklistItemWithDocs[]);
  const progressPct = required > 0 ? Math.round((satisfied / required) * 100) : 0;
  // Same rule as the agent-side page: Commission has no meaning for Listing
  // file records or Referral files, so hide the tab for those.
  const ADMIN_TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "checklist", label: "Checklist" },
    ...(isListing || isReferralFile ? [] : [{ key: "commission" as const, label: "Commission" }]),
    { key: "documents", label: "Documents" },
    { key: "parties", label: "Parties" },
    { key: "activity", label: "Activity" },
  ];

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/transactions" className="mb-2 inline-block text-sm text-[#1B1B1B]/40 hover:text-[#1B1B1B]">← All Files</Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            {file.status !== "PENDING_TRANSFER" && file.propertyAddress ? (
              <>
                <h1 className="text-xl font-bold text-[#1B1B1B]">{file.propertyAddress}</h1>
                <p className="text-sm font-bold text-[#1B1B1B]">{file.city ?? ""}, {file.state} {file.zip ?? ""}</p>
              </>
            ) : (
              <h1 className="text-xl font-bold text-[#1B1B1B]">
                {file.status === "PENDING_TRANSFER" ? "Locked — Pending Transfer" : `${file.city ?? ""} ${file.state} ${file.zip ?? ""}`.trim()}
              </h1>
            )}
            <div className="mt-1 flex items-center gap-3">
              <StatusBadge status={file.status} />
              {file.awaitingReview && (
                <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">Awaiting Review</span>
              )}
              {pendingCount > 0 && (
                <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">{pendingCount} pending</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {file.status === "PENDING_TRANSFER" ? (
              <span className="rounded-full bg-purple-100 px-3 py-1.5 text-xs font-medium text-purple-700">
                Approve the uploaded document below to unlock
              </span>
            ) : (
              <select
                disabled={statusLoading}
                value={file.status}
                onChange={(e) => changeStatus(e.target.value)}
                className="rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2 text-sm text-[#1B1B1B] disabled:opacity-50"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        {actionError && <p className="mt-2 text-xs text-red-600">{actionError}</p>}
        {emailWarning && <p className="mt-2 text-xs text-amber-700">{EMAIL_WARNING_TEXT}</p>}
      </div>

      <div className="mb-6 flex gap-1 rounded-xl bg-[#F2F0EF] p-1 w-fit">
        {ADMIN_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? "bg-white text-[#1B1B1B] shadow-sm" : "text-[#1B1B1B]/50 hover:text-[#1B1B1B]"}`}
          >
            {t.label}
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

      {tab === "checklist" && (
        <div className="space-y-6">
          {(file.checklistItems ?? []).map((item) => (
            <div key={item.id}>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-medium text-[#1B1B1B]">{item.name}</h3>
                {item.isRequired && <span className="text-xs text-[#1B1B1B]/40">Required</span>}
              </div>
              {item.documents?.length === 0 ? (
                <p className="text-sm text-[#1B1B1B]/30 italic">No documents uploaded</p>
              ) : (
                <div className="space-y-3">
                  {(item.documents as FileDocumentRecord[]).map((doc) => (
                    <DocumentReviewCard key={doc.id} document={doc} onReviewed={load} />
                  ))}
                </div>
              )}
            </div>
          ))}
          {(file.checklistItems ?? []).length === 0 && (
            <p className="text-sm text-[#1B1B1B]/40">No checklist items configured for this file.</p>
          )}
        </div>
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

      {tab === "parties" && (
        <PartiesTable
          fileType={fileType as "listing" | "transaction"}
          fileId={id}
          parties={file.parties ?? []}
          onChanged={load}
          readOnly
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
