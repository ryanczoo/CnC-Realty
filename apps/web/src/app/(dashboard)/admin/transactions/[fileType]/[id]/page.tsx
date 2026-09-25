"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowIcon } from "@/components/ui/ArrowIcon";
import { StatusBadge } from "@/components/transactions/StatusBadge";
import { DocumentReviewCard } from "@/components/transactions/DocumentReviewCard";
import { FileStatusSelect } from "@/components/transactions/FileStatusSelect";
import { ConvertListingButton } from "@/components/transactions/ConvertListingButton";
import { ActivityFeed } from "@/components/transactions/ActivityFeed";
import { PartiesTable } from "@/components/transactions/PartiesTable";
import { OverviewTab } from "@/components/transactions/OverviewTab";
import { CommissionTab } from "@/components/transactions/CommissionTab";
import { DocumentsTab } from "@/components/transactions/DocumentsTab";
import { UploadFileButton } from "@/components/transactions/UploadFileButton";
import { useFileUpload } from "@/hooks/useFileUpload";
import { getChecklistProgress, allowedNextStatuses, canDeleteListing, listingStatusOptions, transactionStatusOptions, convertBlockedReason } from "@/lib/transaction-helpers";
import type { FileDocumentRecord, FileChecklistItemWithDocs, ListingFileDetail, TransactionFileDetail } from "@/types/transaction";
import { EMAIL_WARNING_TEXT } from "@/lib/file-messages";

type Tab = "overview" | "checklist" | "commission" | "documents" | "parties" | "activity";

export default function AdminFileDetailPage() {
  const { fileType, id } = useParams<{ fileType: string; id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [file, setFile] = useState<ListingFileDetail | TransactionFileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState(false);
  // Admin can upload documents too — e.g. acting as a paid transaction
  // coordinator, handling paperwork on the agent's behalf — same mechanism
  // ChecklistPanel gives agents, already permitted server-side for ADMIN.
  const { uploadingId, error: uploadError, upload } = useFileUpload(
    fileType === "listing" ? "LISTING" : "TRANSACTION",
    id,
    () => load()
  );

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

  // Only offered for an empty, never-converted listing (canDeleteListing); the
  // server enforces the same rule.
  async function deleteListing() {
    if (!window.confirm("Permanently delete this listing file? This can't be undone.")) return;
    setActionError(null);
    const res = await fetch(`/api/listings/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setActionError(body?.error ?? "Couldn't delete this listing. Please try again.");
      return;
    }
    router.push("/admin/transactions");
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
  const linkedTransactionId = listing?.status === "ACTIVE_UNDER_CONTRACT" ? listing.convertedFiles?.[0]?.id : undefined;
  const listingDeletable = !!listing && canDeleteListing(listing);
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
    ...(isListing
      ? listingStatusOptions(file.status, "ADMIN")
      : isReferralFile ? allowedNextStatuses(kind, file.status, "ADMIN") : transactionStatusOptions(file.status, "ADMIN")),
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
        <Link href="/admin/transactions" className="mb-2 inline-flex items-center gap-1 text-sm text-[#1B1B1B]/40 hover:text-[#1B1B1B]">
          <ArrowIcon direction="left" /> All Files
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            {file.status !== "PENDING_TRANSFER" && file.propertyAddress ? (
              <>
                <h1 className="text-xl font-bold text-[#1B1B1B]">{file.propertyAddress}</h1>
                <p className="text-xl font-bold text-[#1B1B1B]">{file.city ?? ""}, {file.state} {file.zip ?? ""}</p>
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
            {listing?.status === "ACTIVE" && (
              <ConvertListingButton
                listingId={id}
                blockedReason={convertBlockedReason(listing)}
                onConverted={(transactionId) => router.push(`/admin/transactions/transaction/${transactionId}`)}
                onError={setActionError}
              />
            )}
            {linkedTransactionId && (
              <Link href={`/admin/transactions/transaction/${linkedTransactionId}`} className="rounded-full border border-[#1B1B1B]/20 bg-white px-4 py-2 text-sm text-[#1B1B1B] hover:border-[#1B1B1B]/40">
                View Transaction
              </Link>
            )}
            {file.status === "PENDING_TRANSFER" ? (
              <>
                <span className="rounded-full bg-purple-100 px-3 py-1.5 text-xs font-medium text-purple-700">
                  Approve the uploaded document below to unlock
                </span>
                {listingDeletable && (
                  <button onClick={deleteListing} className="text-xs text-red-500 hover:text-red-600">
                    Delete listing…
                  </button>
                )}
              </>
            ) : (
              <FileStatusSelect
                current={file.status}
                statuses={statuses}
                disabled={statusLoading}
                onChange={changeStatus}
                deleteAction={listingDeletable ? { label: "Delete listing…", onSelect: deleteListing } : undefined}
              />
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
          canEdit={!isReferralFile && file.status !== "PENDING_TRANSFER"}
          onSaved={load}
        />
      )}

      {tab === "checklist" && (
        <div className="space-y-6">
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
          {(file.checklistItems ?? []).map((item) => (
            <div key={item.id} className="rounded-xl border border-[#1B1B1B]/10 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-[#1B1B1B]">{item.name}</h3>
                  {item.isRequired && <span className="text-xs text-[#1B1B1B]/40">Required</span>}
                </div>
                <UploadFileButton
                  label="Upload"
                  uploading={uploadingId === item.id}
                  disabled={uploadingId !== null}
                  onSelect={(f) => upload(item.id, f)}
                />
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

          <div className="flex items-center justify-between border-t border-[#1B1B1B]/10 pt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/40">Additional Documents</p>
            <UploadFileButton
              label="Add Document"
              variant="outline"
              uploading={uploadingId === "additional"}
              disabled={uploadingId !== null}
              onSelect={(f) => upload(null, f)}
            />
          </div>
        </div>
      )}

      {tab === "commission" && transaction && (
        <CommissionTab transaction={transaction} />
      )}

      {tab === "documents" && (
        <DocumentsTab
          documents={file.documents as FileDocumentRecord[]}
          checklistItems={file.checklistItems as FileChecklistItemWithDocs[]}
          canDelete
          onChanged={load}
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
