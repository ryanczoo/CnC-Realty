"use client";

import { useState, useEffect } from "react";
import { STAGE_LABELS, formatDealPrice } from "@/lib/deal-pipeline";
import { NewDealModal } from "@/components/deals/NewDealModal";
import type { DealRow } from "@/lib/deal-pipeline";

type Props = {
  leadId: string;
  leadName: string;
};

export function DealsSection({ leadId, leadName }: Props) {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/deals?leadId=${leadId}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setDeals(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
    return () => controller.abort();
  }, [leadId]);

  function handleNewDeal(deal: DealRow) {
    setDeals((ds) => [...ds, deal]);
  }

  return (
    <div className="mt-6 rounded-xl border border-[#1B1B1B]/10 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-sans text-sm font-medium text-[#1B1B1B]">Deals</h3>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg border border-[#1B1B1B]/20 px-3 py-1 font-sans text-xs text-[#1B1B1B]/60 hover:border-[#9E8C61]/40 hover:text-[#9E8C61]"
        >
          + Create Deal
        </button>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-[#1B1B1B]/40">Loading…</p>
      ) : deals.length === 0 ? (
        <p className="font-sans text-sm text-[#1B1B1B]/40">No active deals</p>
      ) : (
        <div className="space-y-2">
          {deals.map((deal) => (
            <a
              key={deal.id}
              href={`/dashboard/pipeline?pipeline=${deal.pipeline}&deal=${deal.id}`}
              className="flex items-center justify-between rounded-lg border border-[#1B1B1B]/10 px-3 py-2 hover:border-[#9E8C61]/30 hover:bg-[#F2F0EF]"
            >
              <div>
                <span className="font-sans text-sm font-medium text-[#1B1B1B]">
                  {STAGE_LABELS[deal.stage as keyof typeof STAGE_LABELS]}
                </span>
                {deal.propertyAddress && (
                  <span className="ml-2 font-sans text-xs text-[#1B1B1B]/50">{deal.propertyAddress}</span>
                )}
              </div>
              <span className="font-sans text-sm text-[#1B1B1B]/60">
                {formatDealPrice(deal.price)}
              </span>
            </a>
          ))}
        </div>
      )}

      <NewDealModal
        open={modalOpen}
        initialLeadId={leadId}
        initialLeadName={leadName}
        onClose={() => setModalOpen(false)}
        onSaved={handleNewDeal}
      />
    </div>
  );
}
