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
