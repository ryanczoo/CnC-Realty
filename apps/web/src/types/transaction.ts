export type ListingStatus =
  | "INCOMPLETE" | "COMING_SOON" | "ACTIVE" | "ACTIVE_UNDER_CONTRACT"
  | "EXPIRED" | "WITHDRAWN" | "CANCELED" | "CLOSED";

export type TransactionFileStatus =
  | "INCOMPLETE" | "PRE_CONTRACT" | "PENDING" | "EXPIRED"
  | "CLOSED" | "ARCHIVED" | "CANCELED_PENDING" | "CANCELED_APPROVED";

export type FileType = "LISTING" | "TRANSACTION";
export type ListingType = "RESIDENTIAL_SALE" | "RESIDENTIAL_LEASE" | "COMMERCIAL";
export type TransactionSide = "BUYER_SIDE" | "SELLER_SIDE" | "DUAL" | "LEASE";
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
}

export interface TransactionFileDetail {
  id: string;
  agentId: string;
  originatingListingId: string | null;
  originatingLeadId: string | null;
  propertyAddress: string;
  city: string;
  state: string;
  zip: string;
  mlsNumber: string | null;
  transactionSide: TransactionSide;
  status: TransactionFileStatus;
  listPrice: number | null;
  salePrice: number | null;
  offerDate: string | null;
  acceptanceDate: string | null;
  inspectionDeadline: string | null;
  appraisalDeadline: string | null;
  loanApprovalDeadline: string | null;
  closeOfEscrow: string | null;
  commissionGCI: number | null;
  commissionSplit: number | null;
  commissionNotes: string | null;
  awaitingReview: boolean;
  createdAt: string;
  updatedAt: string;
  parties: FilePartyRecord[];
  checklistItems: FileChecklistItemWithDocs[];
  documents: FileDocumentRecord[];
  activities: FileActivityRecord[];
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
