import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/r2", () => ({ deleteR2Object: vi.fn() }));
vi.mock("@/lib/email/transaction-emails", () => ({
  sendSubmitForReview: vi.fn(),
  sendDocumentRejected: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    transactionFile: { findUnique: vi.fn(), update: vi.fn() },
    listingFile: { findUnique: vi.fn(), update: vi.fn() },
    fileDocument: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));

import * as Sentry from "@sentry/nextjs";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { sendSubmitForReview, sendDocumentRejected } from "@/lib/email/transaction-emails";
import { POST as submitTransaction } from "../../app/api/transactions/[id]/submit-review/route";
import { POST as submitListing } from "../../app/api/listings/[id]/submit-review/route";
import { POST as rejectDocument } from "../../app/api/admin/documents/[id]/reject/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: null } };
const post = (body: unknown = {}) =>
  new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const AGENT_USER = { agent: { user: { email: "a@x.com", name: "Ann" } } };

// resetAllMocks (not clearAllMocks): a rejected send set in one test must not leak into the next.
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
});

describe("submit for review: an email failure is logged, never shown to the agent", () => {
  it("transaction", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status: "PENDING", checklistItems: [], propertyAddress: "1 A St", ...AGENT_USER } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({} as any);
    vi.mocked(sendSubmitForReview).mockRejectedValue(new Error("Postmark 406"));
    const res = await submitTransaction(post(), { params: { id: "f1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("listing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status: "ACTIVE", checklistItems: [], propertyAddress: "1 A St", ...AGENT_USER } as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({} as any);
    vi.mocked(sendSubmitForReview).mockRejectedValue(new Error("Postmark 406"));
    const res = await submitListing(post(), { params: { id: "f1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("admin document review: an email failure warns the admin", () => {
  it("reject returns emailWarning and still records the rejection", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({ id: "d1", name: "TDS.pdf", fileType: "TRANSACTION", transactionFileId: "f1", listingFileId: null } as any);
    vi.mocked(prisma.fileDocument.update).mockResolvedValue({} as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ propertyAddress: "1 A St", ...AGENT_USER } as any);
    vi.mocked(sendDocumentRejected).mockRejectedValue(new Error("Postmark 406"));
    const res = await rejectDocument(post({ note: "Blurry scan" }), { params: { id: "d1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, emailWarning: true });
    expect(prisma.fileDocument.update).toHaveBeenCalled();
  });

  it("reject returns plain ok when the email is sent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue({ id: "d1", name: "TDS.pdf", fileType: "TRANSACTION", transactionFileId: "f1", listingFileId: null } as any);
    vi.mocked(prisma.fileDocument.update).mockResolvedValue({} as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ propertyAddress: "1 A St", ...AGENT_USER } as any);
    vi.mocked(sendDocumentRejected).mockResolvedValue(undefined);
    const res = await rejectDocument(post({ note: "Blurry scan" }), { params: { id: "d1" } });
    expect(await res.json()).toEqual({ ok: true });
  });
});
