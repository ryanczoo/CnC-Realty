export type ListingStatus =
  | "INCOMPLETE" | "COMING_SOON" | "ACTIVE" | "ACTIVE_UNDER_CONTRACT"
  | "EXPIRED" | "WITHDRAWN" | "CANCELED" | "CLOSED";

export type TransactionFileStatus =
  | "INCOMPLETE" | "PRE_CONTRACT" | "PENDING" | "EXPIRED"
  | "CLOSED" | "ARCHIVED" | "CANCELED_PENDING" | "CANCELED_APPROVED"
  | "REFERRAL_SUCCESSFUL" | "REFERRAL_UNSUCCESSFUL" | "REFERRAL_BROKER_REVIEW";

export type FileType = "LISTING" | "TRANSACTION";
export type ListingType = "RESIDENTIAL_SALE" | "RESIDENTIAL_LEASE" | "COMMERCIAL";
export type TransactionSide = "PURCHASE" | "LISTING" | "DUAL" | "LEASE_TENANT" | "LEASE_LANDLORD" | "LEASE_DUAL" | "REFERRAL";

export const ROLE_LABELS: Record<TransactionSide, string> = {
  PURCHASE: "Buyer's Agent",
  LISTING: "Listing Agent",
  DUAL: "Dual Agent",
  LEASE_TENANT: "Buyer's Agent",
  LEASE_LANDLORD: "Listing Agent",
  LEASE_DUAL: "Dual Agent",
  REFERRAL: "Referral Agent",
};
export type FilePartyRole =
  | "BUYER" | "SELLER" | "LISTING_AGENT" | "BUYERS_AGENT" | "CO_AGENT"
  | "TITLE_ESCROW" | "LENDER" | "TRANSACTION_COORDINATOR" | "OTHER";
export type DocumentReviewStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "NOT_SUBMITTED";
export type FileActivityType =
  | "FILE_CREATED" | "STATUS_CHANGED" | "DOCUMENT_UPLOADED" | "DOCUMENT_APPROVED"
  | "DOCUMENT_REJECTED" | "SUBMITTED_FOR_REVIEW" | "PARTY_ADDED" | "NOTE_ADDED"
  | "CONVERTED_TO_TRANSACTION";

export type ActorRole = "AGENT" | "ADMIN";

export interface FileChecklistItemWithDocs {
  id: string;
  name: string;
  description?: string | null;
  order?: number;
  isRequired: boolean;
  documents: { reviewStatus: DocumentReviewStatus }[];
}

export interface ChecklistProgress {
  satisfied: number;
  required: number;
}

export interface ListingFileDetail {
  id: string;
  agentId: string;
  propertyAddress: string;
  city: string;
  state: string;
  zip: string;
  mlsNumber: string | null;
  listPrice: number;
  listingType: ListingType;
  status: ListingStatus;
  expirationDate: string | null;
  listDate: string | null;
  commissionPercent: number | null;
  commissionNotes: string | null;
  awaitingReview: boolean;
  createdAt: string;
  updatedAt: string;
  parties: FilePartyRecord[];
  checklistItems: FileChecklistItemWithDocs[];
  documents: FileDocumentRecord[];
  activities: FileActivityRecord[];
  tasks: FileTaskRecord[];
}

export interface TransactionFileDetail {
  id: string;
  agentId: string;
  originatingListingId: string | null;
  originatingLeadId: string | null;
  propertyAddress: string | null;
  city: string | null;
  state: string;
  zip: string | null;
  mlsNumber: string | null;
  propertyType: string | null;
  yearBuilt: number | null;
  escrowNumber: string | null;
  transactionSide: TransactionSide;
  status: TransactionFileStatus;
  listPrice: number | null;
  salePrice: number | null;
  leasePrice: number | null;
  legalDescription: string | null;
  propertyIncludes: string | null;
  propertyExcludes: string | null;
  taxId: string | null;
  annualTaxes: number | null;
  schoolDistrict: string | null;
  zoningClass: string | null;
  photoKey: string | null;
  deposit: number | null;
  offerExpirationDate: string | null;
  finalWalkthroughDate: string | null;
  possessionDate: string | null;
  conditions: FileConditionRecord[];
  offerDate: string | null;
  acceptanceDate: string | null;
  inspectionDeadline: string | null;
  appraisalDeadline: string | null;
  loanApprovalDeadline: string | null;
  closeOfEscrow: string | null;
  commissionGCI: number | null;
  saleCommissionPct: number | null;
  listingCommissionPct: number | null;
  otherDeductions: number | null;
  commissionSplit: number | null;
  commissionNotes: string | null;
  tcFeeEnabled: boolean;
  referredToAgentName: string | null;
  referredToBrokerageName: string | null;
  referredToContactEmail: string | null;
  referredToContactPhone: string | null;
  dateReferred: string | null;
  referralAmountReceived: number | null;
  referralCncFee: number | null;
  awaitingReview: boolean;
  createdAt: string;
  updatedAt: string;
  parties: FilePartyRecord[];
  checklistItems: FileChecklistItemWithDocs[];
  documents: FileDocumentRecord[];
  activities: FileActivityRecord[];
  tasks: FileTaskRecord[];
}

export interface FileTaskRecord {
  id: string;
  title: string;
  dueDate: string | null;
  assigneeName: string | null;
  done: boolean;
  createdAt: string;
}

export interface FileConditionRecord {
  id: string;
  name: string;
  dueDate: string | null;
  notes: string | null;
}

export interface FileContextProps {
  fileType: "listing" | "transaction";
  fileId: string;
}

export interface FilePartyRecord {
  id: string;
  role: FilePartyRole;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  licenseNumber: string | null;
}

export interface FileDocumentRecord {
  id: string;
  checklistItemId: string | null;
  name: string;
  r2Url: string;
  uploadedAt: string;
  reviewStatus: DocumentReviewStatus;
  rejectionNote: string | null;
}

export interface FileActivityRecord {
  id: string;
  actorId: string;
  actorRole: ActorRole;
  type: FileActivityType;
  payload: Record<string, unknown> | null;
  note: string | null;
  createdAt: string;
  actor: { name: string | null; email: string };
}
