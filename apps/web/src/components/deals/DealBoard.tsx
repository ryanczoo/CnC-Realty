"use client";

import { useState, type ReactNode } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DealCard } from "./DealCard";
import { PIPELINE_STAGES, STAGE_LABELS, isTerminalStage } from "@/lib/deal-pipeline";
import type { DealRow } from "@/lib/deal-pipeline";
import type { DealPipeline, DealStage } from "@cnc/database";

type Props = {
  pipeline: DealPipeline;
  initialDeals: DealRow[];
  onCardClick: (deal: DealRow) => void;
  onOfferAccepted?: (deal: DealRow) => void;
};

function DroppableStage({ stage, children }: { stage: string; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: stage });
  return (
    <div ref={setNodeRef} className="flex w-56 min-h-[120px] flex-col gap-2 rounded-2xl bg-[#1B1B1B]/5 p-2">
      {children}
    </div>
  );
}

export function DealBoard({ pipeline, initialDeals, onCardClick, onOfferAccepted }: Props) {
  const [deals, setDeals] = useState<DealRow[]>(initialDeals);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const stages = PIPELINE_STAGES[pipeline];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    // over.id is the stage name for an empty/near-empty stage, or a deal id when dropped onto a card
    let newStage = over.id as DealRow["stage"];
    if (!stages.includes(newStage)) {
      const overDeal = deals.find((d) => d.id === over.id);
      if (!overDeal) return;
      newStage = overDeal.stage;
    }

    const deal = deals.find((d) => d.id === active.id);
    if (!deal || deal.stage === newStage) return;

    const prev = deals;
    setDeals((ds) =>
      ds.map((d) =>
        d.id === active.id
          ? { ...d, stage: newStage, stageUpdatedAt: new Date().toISOString(), daysInStage: 0 }
          : d
      )
    );
    setError(null);

    const res = await fetch(`/api/deals/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });

    if (!res.ok) {
      setDeals(prev);
      setError("Failed to move deal. Please try again.");
      return;
    }

    if (isTerminalStage(pipeline, newStage as DealStage) && onOfferAccepted) {
      onOfferAccepted({ ...deal, stage: newStage, stageUpdatedAt: new Date().toISOString(), daysInStage: 0 });
    }
  }

  const activeDeal = deals.find((d) => d.id === activeId);

  return (
    <div className="relative">
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-4 py-2 font-sans text-sm text-red-600">{error}</p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col gap-4">
          {stages.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage);
            return (
              <div key={stage} className="flex w-full flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#1B1B1B]/10 px-2 py-0.5 font-sans text-xs text-[#1B1B1B]/60">
                    {stageDeals.length}
                  </span>
                  <h3 className="font-sans text-sm font-medium text-[#1B1B1B]">
                    {STAGE_LABELS[stage as keyof typeof STAGE_LABELS]}
                  </h3>
                </div>
                <SortableContext id={stage} items={stageDeals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                  <DroppableStage stage={stage}>
                    {stageDeals.map((deal) => (
                      <DealCard key={deal.id} deal={deal} onClick={onCardClick} />
                    ))}
                  </DroppableStage>
                </SortableContext>
              </div>
            );
          })}
        </div>
        <DragOverlay>
          {activeDeal && <DealCard deal={activeDeal} onClick={onCardClick} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
