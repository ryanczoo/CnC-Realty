import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    transactionFile: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    agent: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/email/transaction-emails", () => ({ sendFileClosed: vi.fn() }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/transactions/[id]/route";

function makeRequest() {
  return new Request("http://localhost/api/transactions/tf1");
}

describe("GET /api/transactions/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: { id: "tf1" } });
    expect(res.status).toBe(401);
  });

  it("includes conditions in the GET response", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({
      id: "tf1",
      agentId: "a1",
      conditions: [
        { id: "c1", name: "Inspection Contingency", dueDate: new Date("2026-08-01"), notes: null },
      ],
    } as any);

    const res = await GET(makeRequest(), { params: { id: "tf1" } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.transaction.conditions).toBeDefined();
    expect(body.transaction.conditions).toHaveLength(1);

    // Verify the query itself requests the conditions relation (not just that our mock returned it)
    expect(prisma.transactionFile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          conditions: expect.anything(),
        }),
      })
    );
  });

  it("returns 404 when the transaction file does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest(), { params: { id: "tf1" } });
    expect(res.status).toBe(404);
  });

  it("returns 403 when the requester doesn't own the transaction file", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u2", role: "AGENT", agentId: "a2" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", conditions: [] } as any);

    const res = await GET(makeRequest(), { params: { id: "tf1" } });
    expect(res.status).toBe(403);
  });
});
