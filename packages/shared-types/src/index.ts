export type UserRole = "BUYER" | "AGENT" | "ADMIN";

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "SHOWING"
  | "OFFER"
  | "UNDER_CONTRACT"
  | "CLOSED"
  | "LOST";

export type TransactionStatus =
  | "ACTIVE"
  | "PENDING"
  | "UNDER_CONTRACT"
  | "CLOSED"
  | "CANCELLED";

export type CampaignType = "EMAIL" | "DRIP";
export type CampaignStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "COMPLETED" | "PAUSED";

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
