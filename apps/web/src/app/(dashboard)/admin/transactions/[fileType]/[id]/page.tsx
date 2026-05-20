"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/transactions/StatusBadge";
import { DocumentReviewCard } from "@/components/transactions/DocumentReviewCard";
import { ActivityFeed } from "@/components/transactions/ActivityFeed";
import type { FileDocumentRecord, ListingStatus, TransactionFileStatus } from "@/types/transaction";

type Tab = "documents" | "activity";

const ADMIN_TABS: { key: Tab; label: string }[] = [
  { key: "documents", label: "Documents" },
  { key: "activity", label: "Activity" },
];

const LISTING_STATUSES: ListingStatus[] = ["INCOMPLETE", "COMING_SOON", "ACTIVE", "ACTIVE_UNDER_CONTRACT", "EXPIRED", "WITHDRAWN", "CANCELED", "CLOSED"];
const TRANSACTION_STATUSES: TransactionFileStatus[] = ["INCOMPLETE", "PRE_CONTRACT", "PENDING", "EXPIRED", "CLOSED", "ARCHIVED", "CANCELED_PENDING", "CANCELED_APPROVED"];

export default function AdminFileDetailPage() {
  const { fileType, id } = useParams<{ fileType: string; id: string }>();
  const [tab, setTab] = useState<Tab>("documents");
  const [file, setFile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);

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
    await fetch(`/api/admin/files/${fileType}/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setStatusLoading(false);
    load();
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-[#F2F0EF]" />;
  }

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-[#1B1B1B]/50">File not found.</p>
        <Link href="/admin/transactions" className="mt-4 text-sm text-[#9E8C61] hover:underline">← Back</Link>
      </div>
    );
  }

  const pendingCount = (file.checklistItems ?? []).reduce(
    (n: number, item: any) => n + (item.documents ?? []).filter((d: FileDocumentRecord) => d.reviewStatus === "PENDING_REVIEW").length,
    0
  );
  const statuses = fileType === "listing" ? LISTING_STATUSES : TRANSACTION_STATUSES;

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/transactions" className="mb-2 inline-block text-sm text-[#1B1B1B]/40 hover:text-[#1B1B1B]">← All Files</Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-light text-[#1B1B1B]">{file.propertyAddress}, {file.city}, {file.state} {file.zip}</h1>
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
          </div>
        </div>
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

      {tab === "documents" && (
        <div className="space-y-6">
          {(file.checklistItems ?? []).map((item: any) => (
            <div key={item.id}>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-medium text-[#1B1B1B]">{item.name}</h3>
                {item.isRequired && <span className="text-xs text-[#1B1B1B]/40">Required</span>}
              </div>
              {item.documents?.length === 0 ? (
                <p className="text-sm text-[#1B1B1B]/30 italic">No documents uploaded</p>
              ) : (
                <div className="space-y-3">
                  {item.documents.map((doc: FileDocumentRecord) => (
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
