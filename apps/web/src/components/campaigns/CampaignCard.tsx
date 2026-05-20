import Link from "next/link";

interface CampaignCardProps {
  id: string;
  name: string;
  type: string;
  status: string;
  contactCount: number;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  EMAIL: "bg-blue-50 text-blue-700",
  DRIP: "bg-purple-50 text-purple-700",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-[#F2F0EF] text-[#1B1B1B]/50",
  SCHEDULED: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-green-50 text-green-700",
  PAUSED: "bg-yellow-50 text-yellow-700",
  COMPLETED: "bg-[#9E8C61]/10 text-[#9E8C61]",
};

export function CampaignCard({
  id,
  name,
  type,
  status,
  contactCount,
  createdAt,
}: CampaignCardProps) {
  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

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
            TYPE_COLORS[type] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {type}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-[#1B1B1B]/5 pt-3 font-sans text-xs text-[#1B1B1B]/50">
        <span>{contactCount} recipient{contactCount !== 1 ? "s" : ""}</span>
        <span>{formattedDate}</span>
      </div>
    </Link>
  );
}
