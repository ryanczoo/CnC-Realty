"use client";

import { useState, useRef } from "react";
import { DealCard } from "./DealCard";
import { PIPELINE_STAGES, STAGE_LABELS } from "@/lib/deal-pipeline";
import type { DealRow } from "@/lib/deal-pipeline";
import type { DealPipeline } from "@prisma/client";

type Props = {
  pipeline: DealPipeline;
  initialDeals: DealRow[];
  onCardClick: (deal: DealRow) => void;
  onOfferAccepted?: (deal: DealRow) => void;
};

export function DealBoard({ pipeline, initialDeals, onCardClick, onOfferAccepted }: Props) {
  const [deals, setDeals] = useState<DealRow[]>(initialDeals);
  const [error, setError] = useState<string | null>(null);
  const draggingId = useRef<string | null>(null);

  const stages = PIPELINE_STAGES[pipeline];

  function handleDragStart(e: React.DragEvent, dealId: string) {
    draggingId.current = dealId;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  async function handleDrop(e: React.DragEvent, targetStage: string) {
    e.preventDefault();
    const id = draggingId.current;
    if (!id) return;

    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.stage === targetStage) return;

    const prev = deals;
    setDeals((ds) =>
      ds.map((d) =>
        d.id === id
          ? { ...d, stage: targetStage as DealRow["stage"], stageUpdatedAt: new Date().toISOString(), daysInStage: 0 }
          : d
      )
    );
    setError(null);

    const res = await fetch(`/api/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: targetStage }),
    });

    if (!res.ok) {
      setDeals(prev);
      setError("Failed to move deal. Please try again.");
      return;
    }

    if (targetStage === "OFFER_ACCEPTED" && onOfferAccepted) {
      const deal = deals.find((d) => d.id === id);
      if (deal) onOfferAccepted({
        ...deal,
        stage: "OFFER_ACCEPTED" as DealRow["stage"],
        stageUpdatedAt: new Date().toISOString(),
        daysInStage: 0,
      });
    }
  }

  return (
    <div className="relative">
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-4 py-2 font-sans text-sm text-red-600">{error}</p>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const columnDeals = deals.filter((d) => d.stage === stage);
          return (
            <div
              key={stage}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage)}
              className="flex w-64 flex-shrink-0 flex-col rounded-xl bg-[#F2F0EF] p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-sans text-sm font-medium text-[#1B1B1B]">
                  {STAGE_LABELS[stage as keyof typeof STAGE_LABELS]}
                </h3>
                <span className="rounded-full bg-[#1B1B1B]/10 px-2 py-0.5 font-sans text-xs text-[#1B1B1B]/60">
                  {columnDeals.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {columnDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onClick={onCardClick}
                    onDragStart={handleDragStart}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
