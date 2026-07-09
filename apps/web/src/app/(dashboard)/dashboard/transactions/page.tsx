"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { FileCard } from "@/components/transactions/FileCard";

type Tab = "listings" | "transactions";

export default function TransactionsPage() {
  const [tab, setTab] = useState<Tab>("listings");
  const [listings, setListings] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/listings").then((r) => r.json()),
      fetch("/api/transactions").then((r) => r.json()),
    ]).then(([l, t]) => {
      setListings(l.listings ?? []);
      setTransactions(t.transactions ?? []);
      setLoading(false);
    });
  }, []);

  const items = tab === "listings" ? listings : transactions;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-medium text-[#1B1B1B]">Transactions</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/transactions/new-listing" className="flex items-center gap-1.5 rounded-full border border-[#1B1B1B]/20 px-4 py-2 text-sm text-[#1B1B1B]/60 hover:border-[#1B1B1B]/40 hover:text-[#1B1B1B]">
            <Plus className="h-4 w-4" /> New Listing
          </Link>
          <Link href="/dashboard/transactions/new-transaction" className="flex items-center gap-1.5 rounded-full bg-[#1B1B1B] px-4 py-2 text-sm text-white">
            <Plus className="h-4 w-4" /> New Transaction
          </Link>
        </div>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl bg-[#F2F0EF] p-1 w-fit">
        {(["listings", "transactions"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${tab === t ? "bg-white text-[#1B1B1B] shadow-sm" : "text-[#1B1B1B]/50 hover:text-[#1B1B1B]"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-[#F2F0EF]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1B1B1B]/20 py-16 text-center">
          <p className="text-[#1B1B1B]/40">No {tab} yet</p>
          <Link href={`/dashboard/transactions/new-${tab === "listings" ? "listing" : "transaction"}`} className="mt-3 rounded-full bg-[#1B1B1B] px-4 py-2 text-sm text-white">
            Create your first {tab === "listings" ? "listing" : "transaction"}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <FileCard
              key={item.id}
              id={item.id}
              fileType={tab === "listings" ? "listing" : "transaction"}
              address={item.propertyAddress}
              city={item.city}
              status={item.status}
              closeDate={item.closeOfEscrow ?? item.expirationDate}
              listPrice={item.listPrice}
              checklistItems={item.checklistItems ?? []}
              awaitingReview={item.awaitingReview}
            />
          ))}
        </div>
      )}
    </div>
  );
}
