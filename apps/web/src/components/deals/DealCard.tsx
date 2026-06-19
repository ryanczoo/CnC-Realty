"use client";

import Link from "next/link";
import { formatDealPrice, formatCloseDate, calcDaysInStage } from "@/lib/deal-pipeline";
import type { DealRow } from "@/lib/deal-pipeline";

type Props = {
  deal: DealRow;
  onClick: (deal: DealRow) => void;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
};

export function DealCard({ deal, onClick, onDragStart }: Props) {
  const isAccepted = deal.stage === "OFFER_ACCEPTED";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      onClick={() => onClick(deal)}
      className={`cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md ${
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
