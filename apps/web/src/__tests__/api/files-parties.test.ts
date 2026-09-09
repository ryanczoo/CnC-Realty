process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    fileParty: { create: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/files/[fileType]/[id]/parties/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

function req(body: Record<string, unknown>) {
  return new Request("http://localhost/api/files/listing/f1/parties", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/files/[fileType]/[id]/parties", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the caller does not own the file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);

    const res = await POST(req({ role: "BUYER", name: "Jane" }), { params: { fileType: "listing", id: "f1" } });
    expect(res.status).toBe(404);
    expect(prisma.fileParty.create).not.toHaveBeenCalled();
  });

  it("creates the party when the caller owns the file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
    vi.mocked(prisma.fileParty.create).mockResolvedValue({ id: "p1" } as any);

    const res = await POST(req({ role: "BUYER", name: "Jane" }), { params: { fileType: "listing", id: "f1" } });
    expect(res.status).toBe(201);
    expect(prisma.fileParty.create).toHaveBeenCalledOnce();
  });

  it("rejects an unrecognized fileType with 400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);

    const res = await POST(req({ role: "BUYER", name: "Jane" }), { params: { fileType: "bogus", id: "f1" } });
    expect(res.status).toBe(400);
  });
});
