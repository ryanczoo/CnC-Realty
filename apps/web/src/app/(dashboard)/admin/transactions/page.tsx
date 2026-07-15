"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileCard } from "@/components/transactions/FileCard";

type Tab = "all" | "review";

const TABS: { key: Tab; label: string }[] = [
  { key: "review", label: "Awaiting Review" },
  { key: "all", label: "All Files" },
];

export default function AdminTransactionsPage() {
  const [tab, setTab] = useState<Tab>("review");
  const [auditQueue, setAuditQueue] = useState<any[]>([]);
  const [allFiles, setAllFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/audit-queue").then((r) => r.json()),
      fetch("/api/listings").then((r) => r.json()),
      fetch("/api/transactions").then((r) => r.json()),
    ]).then(([audit, l, t]) => {
      setAuditQueue(audit.files ?? []);
      setAllFiles([...(l.listings ?? []), ...(t.transactions ?? [])]);
      setLoading(false);
    });
  }, []);

  const items = tab === "review" ? auditQueue : allFiles;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-light text-[#1B1B1B]">All Files</h1>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl bg-[#F2F0EF] p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? "bg-white text-[#1B1B1B] shadow-sm" : "text-[#1B1B1B]/50 hover:text-[#1B1B1B]"}`}
          >
            {t.label}
            {t.key === "review" && auditQueue.length > 0 && (
              <span className="ml-1.5 rounded-full bg-[#9E8C61] px-1.5 py-0.5 text-xs text-white">{auditQueue.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-[#F2F0EF]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1B1B1B]/20 py-16 text-center">
          <p className="text-[#1B1B1B]/40">{tab === "review" ? "No files awaiting review" : "No files yet"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/admin/transactions/${item.fileType?.toLowerCase() ?? "listing"}/${item.id}`}
              className="block"
            >
              <FileCard
                id={item.id}
                fileType={item.fileType?.toLowerCase() === "transaction" ? "transaction" : "listing"}
                address={item.propertyAddress}
                city={item.city}
                status={item.status}
                closeDate={item.closeOfEscrow ?? item.expirationDate}
                listPrice={item.listPrice ?? item.salePrice}
                checklistItems={item.checklistItems ?? []}
                awaitingReview={item.awaitingReview}
                referredToAgentName={item.referredToAgentName}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
