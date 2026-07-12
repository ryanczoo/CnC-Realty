"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DealBoard } from "@/components/deals/DealBoard";
import { DealDrawer } from "@/components/deals/DealDrawer";
import { NewDealModal } from "@/components/deals/NewDealModal";
import type { DealRow } from "@/lib/deal-pipeline";

const PIPELINES = ["BUYERS", "SELLERS", "LEASE_TENANT", "LEASE_LANDLORD"] as const;
type PipelineTab = (typeof PIPELINES)[number];

const TAB_LABELS: Record<PipelineTab, string> = {
  BUYERS: "Buyers",
  SELLERS: "Sellers",
  LEASE_TENANT: "Lease Tenant",
  LEASE_LANDLORD: "Lease Landlord",
};

export default function PipelinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("pipeline") as PipelineTab) ?? "BUYERS";

  const [dealsByPipeline, setDealsByPipeline] = useState<Record<PipelineTab, DealRow[]>>({
    BUYERS: [], SELLERS: [], LEASE_TENANT: [], LEASE_LANDLORD: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<DealRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    const responses = await Promise.all(PIPELINES.map((p) => fetch(`/api/deals?pipeline=${p}`)));
    const results = await Promise.all(responses.map((r) => (r.ok ? r.json() : [])));
    setDealsByPipeline(Object.fromEntries(PIPELINES.map((p, i) => [p, results[i]])) as Record<PipelineTab, DealRow[]>);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  function setTab(p: PipelineTab) {
    router.push(`/dashboard/pipeline?pipeline=${p}`);
  }

  function handleCardClick(deal: DealRow) {
    setSelectedDeal(deal);
    setDrawerOpen(true);
  }

  function handleDrawerSaved(updated: DealRow) {
    setDealsByPipeline((prev) => {
      const next = { ...prev };
      for (const p of PIPELINES) next[p] = prev[p].map((d) => (d.id === updated.id ? updated : d));
      return next;
    });
    setSelectedDeal(updated);
  }

  function handleDrawerDeleted(dealId: string) {
    setDealsByPipeline((prev) => {
      const next = { ...prev };
      for (const p of PIPELINES) next[p] = prev[p].filter((d) => d.id !== dealId);
      return next;
    });
    setDrawerOpen(false);
    setSelectedDeal(null);
  }

  function handleConverted(transactionFileId: string) {
    setDrawerOpen(false);
    router.push(`/dashboard/transactions/transaction/${transactionFileId}`);
  }

  function handleModalSaved(deal: DealRow) {
    setDealsByPipeline((prev) => ({ ...prev, [deal.pipeline]: [...prev[deal.pipeline], deal] }));
  }

  const currentDeals = dealsByPipeline[tab];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-sans text-2xl font-medium text-[#1B1B1B]">Pipeline</h1>
          <p className="mt-1 font-sans text-sm text-[#1B1B1B]/50">Track deals from beginning to end</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-[#1B1B1B] px-4 py-2 font-sans text-sm font-medium text-white hover:bg-[#1B1B1B]/80"
        >
          + New Deal
        </button>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl bg-[#F2F0EF] p-1 w-fit">
        {PIPELINES.map((p) => (
          <button
            key={p}
            onClick={() => setTab(p)}
            className={`rounded-lg px-5 py-2 font-sans text-sm transition-colors ${
              tab === p
                ? "bg-white font-medium text-[#1B1B1B] shadow-sm"
                : "text-[#1B1B1B]/50 hover:text-[#1B1B1B]"
            }`}
          >
            {TAB_LABELS[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-[#9E8C61]" />
      ) : (
        <DealBoard
          key={tab}
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
