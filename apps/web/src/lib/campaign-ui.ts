export const CAMPAIGN_TYPE_COLORS: Record<string, string> = {
  EMAIL: "bg-blue-50 text-blue-700",
  DRIP: "bg-purple-50 text-purple-700",
};

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-[#F2F0EF] text-[#1B1B1B]/50",
  SCHEDULED: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-green-50 text-green-700",
  PAUSED: "bg-yellow-50 text-yellow-700",
  COMPLETED: "bg-[#9E8C61]/10 text-[#9E8C61]",
};

export const CONTACT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-500",
  SENT: "bg-blue-50 text-blue-700",
  OPENED: "bg-green-50 text-green-700",
  CLICKED: "bg-purple-50 text-purple-700",
  BOUNCED: "bg-red-50 text-red-500",
  UNSUBSCRIBED: "bg-orange-50 text-orange-600",
};
