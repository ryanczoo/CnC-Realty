"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DealBoard } from "@/components/deals/DealBoard";
import { DealDrawer } from "@/components/deals/DealDrawer";
import { NewDealModal } from "@/components/deals/NewDealModal";
import { fetchDeals, updateDealInList, removeDealFromList } from "@/lib/dashboard-queries";
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
  const queryClient = useQueryClient();

  const buyers = useQuery<DealRow[]>({ queryKey: ["deals", "BUYERS"], queryFn: () => fetchDeals("BUYERS") });
  const sellers = useQuery<DealRow[]>({ queryKey: ["deals", "SELLERS"], queryFn: () => fetchDeals("SELLERS") });
  const leaseTenant = useQuery<DealRow[]>({ queryKey: ["deals", "LEASE_TENANT"], queryFn: () => fetchDeals("LEASE_TENANT") });
  const leaseLandlord = useQuery<DealRow[]>({ queryKey: ["deals", "LEASE_LANDLORD"], queryFn: () => fetchDeals("LEASE_LANDLORD") });

  const dealsByPipeline: Record<PipelineTab, DealRow[]> = {
    BUYERS: buyers.data ?? [],
    SELLERS: sellers.data ?? [],
    LEASE_TENANT: leaseTenant.data ?? [],
    LEASE_LANDLORD: leaseLandlord.data ?? [],
  };
  const loading = buyers.isLoading || sellers.isLoading || leaseTenant.isLoading || leaseLandlord.isLoading;

  const [selectedDeal, setSelectedDeal] = useState<DealRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  function setTab(p: PipelineTab) {
    router.push(`/dashboard/pipeline?pipeline=${p}`);
  }

  function handleCardClick(deal: DealRow) {
    setSelectedDeal(deal);
    setDrawerOpen(true);
  }

  function handleDrawerSaved(updated: DealRow) {
    for (const p of PIPELINES) {
      queryClient.setQueryData<DealRow[]>(["deals", p], (prev) => updateDealInList(prev, updated));
    }
    setSelectedDeal(updated);
  }

  function handleDrawerDeleted(dealId: string) {
    for (const p of PIPELINES) {
      queryClient.setQueryData<DealRow[]>(["deals", p], (prev) => removeDealFromList(prev, dealId));
    }
    setDrawerOpen(false);
    setSelectedDeal(null);
  }

  function handleConverted(transactionFileId: string) {
    setDrawerOpen(false);
    router.push(`/dashboard/transactions/transaction/${transactionFileId}`);
  }

  function handleModalSaved(deal: DealRow) {
    queryClient.setQueryData<DealRow[]>(["deals", deal.pipeline], (prev) => [...(prev ?? []), deal]);
  }

  function handleDealUpdated(updated: DealRow) {
    queryClient.setQueryData<DealRow[]>(["deals", tab], (prev) => updateDealInList(prev, updated));
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
          onDealUpdated={handleDealUpdated}
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
