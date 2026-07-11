"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDealPrice, formatCloseDate, calcDaysInStage, isTerminalStage } from "@/lib/deal-pipeline";
import type { DealRow } from "@/lib/deal-pipeline";

type Props = {
  deal: DealRow;
  onClick: (deal: DealRow) => void;
};

export function DealCard({ deal, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });
  const isAccepted = isTerminalStage(deal.pipeline, deal.stage);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
      onClick={() => onClick(deal)}
      className={`cursor-grab rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${
        isAccepted ? "border-l-2 border-l-[#9E8C61] border-[#1B1B1B]/10" : "border-[#1B1B1B]/10"
      }`}
    >
      <p className="mb-1 font-sans text-sm font-medium text-[#1B1B1B] truncate">
        <Link
          href={`/dashboard/leads/${deal.leadId}`}
          onClick={(e) => e.stopPropagation()}
          className="hover:text-[#9E8C61]"
        >
          {deal.leadName}
        </Link>
      </p>
      <p className="font-sans text-xs text-[#1B1B1B]/50 truncate">
        {deal.propertyAddress ?? "No address yet"}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-sans text-xs font-medium text-[#1B1B1B]">
          {formatDealPrice(deal.price)}
        </span>
        <span className="font-sans text-xs text-[#1B1B1B]/40">
          {formatCloseDate(deal.expectedCloseDate)}
        </span>
      </div>
      <p className="mt-1 font-sans text-xs text-[#1B1B1B]/40">
        Day {calcDaysInStage(deal.stageUpdatedAt)}
      </p>
    </div>
  );
}
