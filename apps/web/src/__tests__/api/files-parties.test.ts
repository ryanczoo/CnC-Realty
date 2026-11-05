process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/file-status", () => ({ maybeAutoPending: vi.fn() }));
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
import { maybeAutoPending } from "@/lib/file-status";
import { AGENT_VIEW_HEADER } from "@/lib/agent-view";

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

describe("adding a party can complete a transaction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("re-checks automatic Pending after adding a party to a transaction", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "t1", agentId: "a1", status: "INCOMPLETE" } as any);
    vi.mocked(prisma.fileParty.create).mockResolvedValue({ id: "p1" } as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
    const res = await POST(
      new Request("http://localhost/api/files/transaction/t1/parties", { method: "POST", body: JSON.stringify({ role: "BUYER", name: "Bea" }) }),
      { params: { fileType: "transaction", id: "t1" } },
    );
    expect(res.status).toBe(201);
    expect(maybeAutoPending).toHaveBeenCalledWith("t1", { userId: "u1", role: "AGENT" });
  });

  it("doesn't for a listing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status: "ACTIVE" } as any);
    vi.mocked(prisma.fileParty.create).mockResolvedValue({ id: "p1" } as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
    await POST(req({ role: "SELLER", name: "Sam" }), { params: { fileType: "listing", id: "f1" } });
    expect(maybeAutoPending).not.toHaveBeenCalled();
  });
});

describe("POST /api/files/[fileType]/[id]/parties — agent-view marker", () => {
  const VIEWING_ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: "a1" } };
  const marked = (type: string, id: string) =>
    new Request(`http://localhost/api/files/${type}/${id}/parties`, {
      method: "POST",
      headers: { [AGENT_VIEW_HEADER]: "1" },
      body: JSON.stringify({ role: "BUYER", name: "Jane" }),
    });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(VIEWING_ADMIN as any);
    vi.mocked(prisma.fileParty.create).mockResolvedValue({ id: "p1" } as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  });

  it("refuses another agent's file with the marker, allows it without", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);
    expect((await POST(marked("listing", "f1"), { params: { fileType: "listing", id: "f1" } })).status).toBe(404);
    expect(prisma.fileParty.create).not.toHaveBeenCalled();
    expect((await POST(req({ role: "BUYER", name: "Jane" }), { params: { fileType: "listing", id: "f1" } })).status).toBe(201);
  });

  it("logs the party and the automatic Pending check as the agent's when the marker is sent", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "t1", agentId: "a1", status: "INCOMPLETE" } as any);
    expect((await POST(marked("transaction", "t1"), { params: { fileType: "transaction", id: "t1" } })).status).toBe(201);
    expect(vi.mocked(prisma.fileActivity.create).mock.calls[0][0].data).toMatchObject({ actorRole: "AGENT", type: "PARTY_ADDED" });
    expect(maybeAutoPending).toHaveBeenCalledWith("t1", { userId: "admin1", role: "AGENT" });
  });
});
