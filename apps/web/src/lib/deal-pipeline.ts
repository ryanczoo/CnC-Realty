import type { DealPipeline, DealStage } from "@cnc/database";

export const PIPELINE_STAGES: Record<DealPipeline, DealStage[]> = {
  BUYERS: ["PRE_APPROVAL", "TOURING", "OFFER_SUBMITTED", "OFFER_ACCEPTED", "FALLEN_OUT"],
  SELLERS: ["LISTING_APPOINTMENT", "ACTIVE_LISTING", "OFFER_ACCEPTED", "FALLEN_OUT"],
  LEASE_TENANT: ["SEARCHING", "TOURING", "APPLICATION_SUBMITTED", "LEASE_SIGNED", "FALLEN_OUT"],
  LEASE_LANDLORD: ["LISTING_APPOINTMENT", "ACTIVE_LISTING", "APPLICATION_RECEIVED", "LEASE_SIGNED", "FALLEN_OUT"],
};

export const STAGE_LABELS: Record<DealStage, string> = {
  PRE_APPROVAL: "Pre-Approval",
  TOURING: "Touring",
  OFFER_SUBMITTED: "Offer Submitted",
  LISTING_APPOINTMENT: "Listing Appointment",
  ACTIVE_LISTING: "Active Listing",
  OFFER_ACCEPTED: "Offer Accepted",
  SEARCHING: "Searching",
  APPLICATION_SUBMITTED: "Application Submitted",
  APPLICATION_RECEIVED: "Application Received",
  LEASE_SIGNED: "Lease Signed",
  FALLEN_OUT: "Fallen Out",
};

export function isValidStageForPipeline(stage: string, pipeline: string): boolean {
  return (PIPELINE_STAGES as Record<string, string[]>)[pipeline]?.includes(stage) ?? false;
}

export function calcDaysInStage(stageUpdatedAt: Date | string): number {
  const updated = typeof stageUpdatedAt === "string" ? new Date(stageUpdatedAt) : stageUpdatedAt;
  return Math.floor((Date.now() - updated.getTime()) / 86400_000);
}

export function formatDealPrice(price: number | null): string {
  if (price === null) return "—";
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  return `$${Math.round(price / 1000)}k`;
}

export function formatCloseDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export type DealRow = {
  id: string;
  leadId: string;
  leadName: string;
  pipeline: DealPipeline;
  stage: DealStage;
  propertyAddress: string | null;
  price: number | null;
  expectedCloseDate: string | null;
  notes: string | null;
  transactionFileId: string | null;
  daysInStage: number;
  stageUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
};
