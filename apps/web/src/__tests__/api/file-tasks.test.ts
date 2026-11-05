process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
    fileTask: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../app/api/file-tasks/route";
import { AGENT_VIEW_HEADER } from "@/lib/agent-view";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

function getReq(fileType: string, fileId: string) {
  return new Request(`http://localhost/api/file-tasks?fileType=${fileType}&fileId=${fileId}`);
}
function postReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/file-tasks", { method: "POST", body: JSON.stringify(body) });
}

describe("GET/POST /api/file-tasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET: currently lets a non-owning agent list another agent's file tasks", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);

    const res = await GET(getReq("listing", "f1"));
    expect(res.status).toBe(403);
    expect(prisma.fileTask.findMany).not.toHaveBeenCalled();
  });

  it("GET: allows the owning agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);
    vi.mocked(prisma.fileTask.findMany).mockResolvedValue([] as any);

    const res = await GET(getReq("listing", "f1"));
    expect(res.status).toBe(200);
  });

  it("POST: currently lets a non-owning agent create a task on another agent's file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "t1", agentId: "a2" } as any);

    const res = await POST(postReq({ fileType: "transaction", fileId: "t1", title: "Sneak in a task" }));
    expect(res.status).toBe(403);
    expect(prisma.fileTask.create).not.toHaveBeenCalled();
  });

  it("POST: allows the owning agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "t1", agentId: "a1" } as any);
    vi.mocked(prisma.fileTask.create).mockResolvedValue({ id: "task1" } as any);

    const res = await POST(postReq({ fileType: "transaction", fileId: "t1", title: "Real task" }));
    expect(res.status).toBe(201);
  });
});

describe("POST /api/file-tasks — agent-view marker", () => {
  const VIEWING_ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: "a1" } };
  const payload = { fileType: "transaction", fileId: "t1", title: "Call title co" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(VIEWING_ADMIN as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "t1", agentId: "a2", status: "PENDING" } as any);
    vi.mocked(prisma.fileTask.create).mockResolvedValue({ id: "task1" } as any);
  });

  it("refuses another agent's file with the marker, allows it without", async () => {
    const marked = new Request("http://localhost/api/file-tasks", { method: "POST", headers: { [AGENT_VIEW_HEADER]: "1" }, body: JSON.stringify(payload) });
    expect((await POST(marked)).status).toBe(403);
    expect(prisma.fileTask.create).not.toHaveBeenCalled();
    expect((await POST(postReq(payload))).status).toBe(201);
  });

  it("locks a closed file for the admin with the marker, open without", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "t1", agentId: "a1", status: "CLOSED" } as any);
    const marked = new Request("http://localhost/api/file-tasks", { method: "POST", headers: { [AGENT_VIEW_HEADER]: "1" }, body: JSON.stringify(payload) });
    expect((await POST(marked)).status).toBe(403);
    expect((await POST(postReq(payload))).status).toBe(201);
  });
});
