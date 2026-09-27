process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fileParty: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PATCH, DELETE } from "../../app/api/files/[fileType]/[id]/parties/[partyId]/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const PARAMS = { params: { fileType: "listing", id: "f1", partyId: "p1" } };

function patchReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/files/listing/f1/parties/p1", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH/DELETE /api/files/[fileType]/[id]/parties/[partyId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PATCH: currently lets a non-owning agent edit another agent's party record", async () => {
    // This is the vulnerability: fileParty belongs to a listing owned by
    // a different agent (a2), but the caller (a1) is never checked against it.
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileParty.findUnique).mockResolvedValue({
      id: "p1", listingFileId: "f1", transactionFileId: null,
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);

    const res = await PATCH(patchReq({ name: "Hacked Name" }), PARAMS);
    expect(res.status).toBe(403);
    expect(prisma.fileParty.update).not.toHaveBeenCalled();
  });

  it("PATCH: allows the owning agent to edit", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileParty.findUnique).mockResolvedValue({
      id: "p1", listingFileId: "f1", transactionFileId: null,
    } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
    vi.mocked(prisma.fileParty.update).mockResolvedValue({ id: "p1", name: "Jane" } as any);

    const res = await PATCH(patchReq({ name: "Jane" }), PARAMS);
    expect(res.status).toBe(200);
    expect(prisma.fileParty.update).toHaveBeenCalledOnce();
  });

  it("DELETE: forbids a non-owning agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileParty.findUnique).mockResolvedValue({
      id: "p1", listingFileId: null, transactionFileId: "t1",
    } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "t1", agentId: "a2" } as any);

    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), PARAMS);
    expect(res.status).toBe(403);
    expect(prisma.fileParty.delete).not.toHaveBeenCalled();
  });
});

describe("a transaction's last client can't be removed past Pre-Contract", () => {
  const TX_PARAMS = { params: { fileType: "transaction", id: "t1", partyId: "p1" } };
  const txPatch = (body: Record<string, unknown>) =>
    new Request("http://localhost/api/files/transaction/t1/parties/p1", { method: "PATCH", body: JSON.stringify(body) });
  const onlyBuyer = { id: "p1", role: "BUYER", name: "Bea", listingFileId: null, transactionFileId: "t1" };
  const withFile = (status: string, parties: object[]) => {
    vi.mocked(prisma.transactionFile.findUnique)
      .mockResolvedValueOnce({ id: "t1", agentId: "a1", status } as any)
      .mockResolvedValueOnce({ status, transactionSide: "PURCHASE", parties } as any);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.fileParty.findUnique).mockResolvedValue(onlyBuyer as any);
  });

  it("refuses deleting the only buyer on a Pending purchase", async () => {
    withFile("PENDING", [onlyBuyer]);
    const res = await DELETE(new Request("http://localhost"), TX_PARAMS);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("This transaction needs a named buyer");
    expect(prisma.fileParty.delete).not.toHaveBeenCalled();
  });

  it("refuses blanking the only buyer's name", async () => {
    withFile("PENDING", [onlyBuyer]);
    const res = await PATCH(txPatch({ name: "" }), TX_PARAMS);
    expect(res.status).toBe(400);
    expect(prisma.fileParty.update).not.toHaveBeenCalled();
  });

  it("allows it when another buyer remains, or while still Pre-Contract", async () => {
    withFile("PENDING", [onlyBuyer, { id: "p2", role: "BUYER", name: "Ben" }]);
    expect((await DELETE(new Request("http://localhost"), TX_PARAMS)).status).toBe(200);
    withFile("PRE_CONTRACT", [onlyBuyer]);
    expect((await DELETE(new Request("http://localhost"), TX_PARAMS)).status).toBe(200);
  });

  it("allows renaming the buyer (the name stays filled)", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValueOnce({ id: "t1", agentId: "a1", status: "PENDING" } as any);
    vi.mocked(prisma.fileParty.update).mockResolvedValue(onlyBuyer as any);
    expect((await PATCH(txPatch({ name: "Beatrice" }), TX_PARAMS)).status).toBe(200);
  });
});
