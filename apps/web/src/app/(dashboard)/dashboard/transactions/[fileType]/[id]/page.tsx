"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/transactions/StatusBadge";
import { ChecklistPanel } from "@/components/transactions/ChecklistPanel";
import { PartiesTable } from "@/components/transactions/PartiesTable";
import { ActivityFeed } from "@/components/transactions/ActivityFeed";
import { getChecklistProgress } from "@/lib/transaction-helpers";
import type { ListingFileDetail, TransactionFileDetail, FileChecklistItemWithDocs } from "@/types/transaction";

type Tab = "overview" | "checklist" | "parties" | "activity";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "checklist", label: "Checklist" },
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
  const abortRef = useRef<AbortController | null>(null);

  function load() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const endpoint = fileType === "listing" ? `/api/listings/${id}` : `/api/transactions/${id}`;
    fetch(endpoint, { signal: controller.signal })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) setFile(data.listing ?? data.transaction);
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

      <div className="mb-6 flex gap-1 rounded-xl bg-[#F2F0EF] p-1 w-fit">
        {TABS.map((t) => (
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                <InfoRow label="Sale Price" value={transaction.salePrice ? `$${Number(transaction.salePrice).toLocaleString()}` : "—"} />
                <InfoRow label="Transaction Side" value={transaction.transactionSide ?? "—"} />
                {transaction.closeOfEscrow && <InfoRow label="Close of Escrow" value={new Date(transaction.closeOfEscrow).toLocaleDateString()} />}
                {transaction.commissionGCI && <InfoRow label="GCI" value={`$${Number(transaction.commissionGCI).toLocaleString()}`} />}
                {transaction.commissionSplit && <InfoRow label="Commission Split" value={`${transaction.commissionSplit}%`} />}
              </>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#1B1B1B]/5 pb-2 text-sm">
      <span className="text-[#1B1B1B]/50">{label}</span>
      <span className="text-right font-medium text-[#1B1B1B]">{value}</span>
    </div>
  );
}
