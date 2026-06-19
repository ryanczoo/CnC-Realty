"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DealBoard } from "@/components/deals/DealBoard";
import { DealDrawer } from "@/components/deals/DealDrawer";
import { NewDealModal } from "@/components/deals/NewDealModal";
import type { DealRow } from "@/lib/deal-pipeline";

export default function PipelinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("pipeline") as "BUYERS" | "SELLERS") ?? "BUYERS";

  const [buyerDeals, setBuyerDeals] = useState<DealRow[]>([]);
  const [sellerDeals, setSellerDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<DealRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    const [buyersRes, sellersRes] = await Promise.all([
      fetch("/api/deals?pipeline=BUYERS"),
      fetch("/api/deals?pipeline=SELLERS"),
    ]);
    if (buyersRes.ok) setBuyerDeals(await buyersRes.json());
    if (sellersRes.ok) setSellerDeals(await sellersRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  function setTab(p: "BUYERS" | "SELLERS") {
    router.push(`/dashboard/pipeline?pipeline=${p}`);
  }

  function handleCardClick(deal: DealRow) {
    setSelectedDeal(deal);
    setDrawerOpen(true);
  }

  function handleDrawerSaved(updated: DealRow) {
    const update = (ds: DealRow[]) => ds.map((d) => d.id === updated.id ? updated : d);
    setBuyerDeals(update);
    setSellerDeals(update);
    setSelectedDeal(updated);
  }

  function handleDrawerDeleted(dealId: string) {
    const remove = (ds: DealRow[]) => ds.filter((d) => d.id !== dealId);
    setBuyerDeals(remove);
    setSellerDeals(remove);
    setDrawerOpen(false);
    setSelectedDeal(null);
  }

  function handleConverted(transactionFileId: string) {
    setDrawerOpen(false);
    router.push(`/dashboard/transactions/transaction/${transactionFileId}`);
  }

  function handleModalSaved(deal: DealRow) {
    if (deal.pipeline === "BUYERS") setBuyerDeals((ds) => [...ds, deal]);
    else setSellerDeals((ds) => [...ds, deal]);
  }

  const currentDeals = tab === "BUYERS" ? buyerDeals : sellerDeals;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-sans text-2xl font-medium text-[#1B1B1B]">Pipeline</h1>
          <p className="mt-1 font-sans text-sm text-[#1B1B1B]/50">Track deals from first contact to offer accepted</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-[#1B1B1B] px-4 py-2 font-sans text-sm font-medium text-white hover:bg-[#1B1B1B]/80"
        >
          + New Deal
        </button>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl bg-[#F2F0EF] p-1 w-fit">
        {(["BUYERS", "SELLERS"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setTab(p)}
            className={`rounded-lg px-5 py-2 font-sans text-sm transition-colors ${
              tab === p
                ? "bg-white font-medium text-[#1B1B1B] shadow-sm"
                : "text-[#1B1B1B]/50 hover:text-[#1B1B1B]"
            }`}
          >
            {p === "BUYERS" ? "Buyers" : "Sellers"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="font-sans text-sm text-[#1B1B1B]/40">Loading…</p>
      ) : (
        <DealBoard
          pipeline={tab}
          initialDeals={currentDeals}
          onCardClick={handleCardClick}
          onOfferAccepted={(deal) => { setSelectedDeal(deal); setDrawerOpen(true); }}
        />
      )}

      <DealDrawer
        open={drawerOpen}
        deal={selectedDeal}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleDrawerSaved}
        onDeleted={handleDrawerDeleted}
        onConverted={handleConverted}
      />

      <NewDealModal
        open={modalOpen}
        initialPipeline={tab}
        onClose={() => setModalOpen(false)}
        onSaved={handleModalSaved}
      />
    </div>
  );
}
