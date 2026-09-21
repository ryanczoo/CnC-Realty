import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/r2", () => ({ deleteR2Object: vi.fn() }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendSubmitForReview: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    fileDocument: { findUnique: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { DELETE as deleteDocument } from "../../app/api/documents/[id]/route";
import { POST as postCondition } from "../../app/api/transactions/[id]/conditions/route";
import { POST as submitTransaction } from "../../app/api/transactions/[id]/submit-review/route";
import { POST as submitListing } from "../../app/api/listings/[id]/submit-review/route";
import { POST as convertListing } from "../../app/api/listings/[id]/convert/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const LOCK_MESSAGE = "This file is closed and can't be changed";
const req = () => new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Inspection" }) });

const CLOSED_TX = { id: "f1", agentId: "a1", status: "CLOSED", checklistItems: [], agent: { user: { name: "Ann" } }, propertyAddress: "1 A St" };
const CLOSED_LISTING = { id: "f1", agentId: "a1", status: "CLOSED", listingType: "RESIDENTIAL_SALE", checklistItems: [], agent: { user: { name: "Ann" } }, propertyAddress: "1 A St" };

const CALLS: [string, () => Promise<Response>][] = [
  ["DELETE /api/documents/[id]", () => deleteDocument(new Request("http://localhost"), { params: { id: "d1" } })],
  ["POST transaction conditions", () => postCondition(req(), { params: { id: "f1" } })],
  ["POST transaction submit-review", () => submitTransaction(req(), { params: { id: "f1" } })],
  ["POST listing submit-review", () => submitListing(req(), { params: { id: "f1" } })],
  ["POST listing convert", () => convertListing(req(), { params: { id: "f1" } })],
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
  vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(CLOSED_TX as any);
  vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(CLOSED_LISTING as any);
  vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
    id: "d1", reviewStatus: "PENDING_REVIEW", uploadedByAgentId: "u1", transactionFileId: "f1", listingFileId: null, r2Key: "k",
  } as any);
});

describe("closed files are read-only for agents (routes with their own lookup)", () => {
  it.each(CALLS)("%s returns the lock 403 when the file is closed", async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(LOCK_MESSAGE);
  });

  it("deleting a document on a listing file checks the listing's status", async () => {
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({
      id: "d1", reviewStatus: "PENDING_REVIEW", uploadedByAgentId: "u1", transactionFileId: null, listingFileId: "f1", r2Key: "k",
    } as any);
    const res = await deleteDocument(new Request("http://localhost"), { params: { id: "d1" } });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(LOCK_MESSAGE);
  });
});
