process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    fileActivity: { create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/files/[fileType]/[id]/note/route";
import { AGENT_VIEW_HEADER } from "@/lib/agent-view";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

function req(note: string) {
  return new Request("http://localhost/api/files/listing/f1/note", { method: "POST", body: JSON.stringify({ note }) });
}

describe("POST /api/files/[fileType]/[id]/note", () => {
  beforeEach(() => vi.clearAllMocks());

  it("currently lets a non-owning agent post a note into another agent's file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);

    const res = await POST(req("fabricated note"), { params: { fileType: "listing", id: "f1" } });
    expect(res.status).toBe(403);
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
  });

  it("allows the owning agent to post a note", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({ id: "act1" } as any);

    const res = await POST(req("real note"), { params: { fileType: "listing", id: "f1" } });
    expect(res.status).toBe(200);
    expect(prisma.fileActivity.create).toHaveBeenCalledOnce();
  });

  it("rejects an unrecognized fileType with 400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);

    const res = await POST(req("some note"), { params: { fileType: "bogus", id: "f1" } });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/files/[fileType]/[id]/note — agent-view marker", () => {
  const VIEWING_ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: "a1" } };
  const marked = (note: string) =>
    new Request("http://localhost/api/files/listing/f1/note", { method: "POST", headers: { [AGENT_VIEW_HEADER]: "1" }, body: JSON.stringify({ note }) });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(VIEWING_ADMIN as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({ id: "act1" } as any);
  });

  it("refuses another agent's file with the marker, allows it without", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);
    expect((await POST(marked("hi"), { params: { fileType: "listing", id: "f1" } })).status).toBe(403);
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
    expect((await POST(req("hi"), { params: { fileType: "listing", id: "f1" } })).status).toBe(200);
  });

  it("records the note as the agent's when the marker is sent", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
    expect((await POST(marked("hi"), { params: { fileType: "listing", id: "f1" } })).status).toBe(200);
    expect(vi.mocked(prisma.fileActivity.create).mock.calls[0][0].data).toMatchObject({ actorRole: "AGENT" });
  });
});
