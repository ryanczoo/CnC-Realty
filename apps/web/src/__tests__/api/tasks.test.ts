import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    leadTask: { findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/tasks/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const SESSION_ADMIN = { user: { id: "u2", role: "ADMIN", agentId: null } };
const AGENT = { id: "a1" };

const TASK_DB = {
  id: "t1", leadId: "l1", title: "Call back", taskType: "CALL",
  notes: null, dueDate: new Date("2026-06-20T10:00:00Z"),
  done: false, completedAt: null, createdAt: new Date("2026-06-19T08:00:00Z"),
  lead: { agentId: "a1", firstName: "Jane", lastName: "Doe" },
};

describe("GET /api/tasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/tasks"));
    expect(res.status).toBe(401);
  });

  it("returns tasks with lead name for authenticated agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.leadTask.findMany).mockResolvedValue([TASK_DB] as any);

    const res = await GET(new Request("http://localhost/api/tasks"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].leadFirstName).toBe("Jane");
    expect(data[0].leadLastName).toBe("Doe");
    expect(data[0].leadId).toBe("l1");
    expect(typeof data[0].createdAt).toBe("string");
  });

  it("uses session.agentId directly, without querying prisma.agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.leadTask.findMany).mockResolvedValue([] as any);

    await GET(new Request("http://localhost/api/tasks"));

    expect(prisma.agent.findUnique).not.toHaveBeenCalled();
    expect(prisma.leadTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ lead: { agentId: "a1" } }) })
    );
  });

  it("returns 404 when agent session has no agentId", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u3", role: "AGENT", agentId: null } } as any);

    const res = await GET(new Request("http://localhost/api/tasks"));
    expect(res.status).toBe(404);
  });

  it("filters by done=false", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.leadTask.findMany).mockResolvedValue([] as any);

    await GET(new Request("http://localhost/api/tasks?done=false"));
    expect(prisma.leadTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ done: false }) })
    );
  });

  it("filters by done=true", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.leadTask.findMany).mockResolvedValue([] as any);

    await GET(new Request("http://localhost/api/tasks?done=true"));
    expect(prisma.leadTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ done: true }) })
    );
  });

  it("admin sees all tasks (no agentId filter)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_ADMIN as any);
    vi.mocked(prisma.leadTask.findMany).mockResolvedValue([] as any);

    await GET(new Request("http://localhost/api/tasks"));
    expect(prisma.agent.findUnique).not.toHaveBeenCalled();
    expect(prisma.leadTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ lead: expect.anything() }) })
    );
  });
});
