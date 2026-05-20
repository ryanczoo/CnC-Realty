import Link from "next/link";
import { CAMPAIGN_STATUS_COLORS, CAMPAIGN_TYPE_COLORS } from "@/lib/campaign-ui";
import { formatDate, toTitleCase } from "@/lib/utils";

interface CampaignCardProps {
  id: string;
  name: string;
  type: string;
  status: string;
  contactCount: number;
  createdAt: string;
}

export function CampaignCard({
  id,
  name,
  type,
  status,
  contactCount,
  createdAt,
}: CampaignCardProps) {
  return (
    <Link
      href={`/dashboard/campaigns/${id}`}
      className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-sans text-base font-medium text-[#1B1B1B] leading-snug line-clamp-2">
          {name}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            CAMPAIGN_TYPE_COLORS[type] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {type}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            CAMPAIGN_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {toTitleCase(status)}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-[#1B1B1B]/5 pt-3 font-sans text-xs text-[#1B1B1B]/50">
        <span>{contactCount} recipient{contactCount !== 1 ? "s" : ""}</span>
        <span>{formatDate(createdAt)}</span>
      </div>
    </Link>
  );
}
