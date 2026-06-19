import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    lead: { findUnique: vi.fn() },
    leadTask: { findMany: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/leads/[id]/tasks/route";
import { PATCH } from "../../app/api/leads/[id]/tasks/[taskId]/route";

const SESSION = { user: { id: "u1", role: "AGENT" } };
const AGENT = { id: "a1" };
const LEAD = { agentId: "a1" };
const TASK = {
  id: "t1", leadId: "l1", title: "Call back", taskType: "CALL",
  assigneeId: null, dueDate: new Date("2026-06-20T10:00:00Z"),
  notes: "Left voicemail", done: false, completedAt: null,
  createdAt: new Date("2026-06-19T08:00:00Z"),
};

const PARAMS = { params: { id: "l1" } };
const TASK_PARAMS = { params: { id: "l1", taskId: "t1" } };

describe("GET /api/leads/[id]/tasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/leads/l1/tasks"), PARAMS);
    expect(res.status).toBe(401);
  });

  it("returns 404 when agent does not own lead", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({ agentId: "other" } as any);
    const res = await GET(new Request("http://localhost/api/leads/l1/tasks"), PARAMS);
    expect(res.status).toBe(404);
  });

  it("returns task list ordered by createdAt asc", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.leadTask.findMany).mockResolvedValue([TASK] as any);

    const res = await GET(new Request("http://localhost/api/leads/l1/tasks"), PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].notes).toBe("Left voicemail");
    expect(prisma.leadTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leadId: "l1" }, orderBy: { createdAt: "asc" } })
    );
  });
});

describe("PATCH /api/leads/[id]/tasks/[taskId] — notes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts and persists notes field", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.leadTask.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.leadTask.findFirst).mockResolvedValue({ ...TASK, notes: "Updated note" } as any);

    const req = new Request("http://localhost/api/leads/l1/tasks/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Updated note" }),
    });
    const res = await PATCH(req, TASK_PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.notes).toBe("Updated note");
  });

  it("accepts notes: null to clear notes", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(LEAD as any);
    vi.mocked(prisma.leadTask.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.leadTask.findFirst).mockResolvedValue({ ...TASK, notes: null } as any);

    const req = new Request("http://localhost/api/leads/l1/tasks/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: null }),
    });
    const res = await PATCH(req, TASK_PARAMS);
    expect(res.status).toBe(200);
    expect(prisma.leadTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ notes: null }) })
    );
  });
});
