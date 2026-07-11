import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fileCondition: { findMany: vi.fn(), create: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../app/api/transactions/[id]/conditions/route";

function makeRequest(body?: unknown, method: string = "POST") {
  return new Request("http://localhost", {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/transactions/[id]/conditions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), { params: { id: "tf1" } });
    expect(res.status).toBe(401);
  });

  it("returns conditions ordered by dueDate when authenticated and owns the file", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1" } as any);
    const mockConditions = [
      { id: "c1", transactionFileId: "tf1", name: "Inspection Contingency", dueDate: new Date("2026-08-01"), notes: null, createdAt: new Date() },
    ];
    vi.mocked(prisma.fileCondition.findMany).mockResolvedValue(mockConditions as any);

    const res = await GET(new Request("http://localhost"), { params: { id: "tf1" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(prisma.fileCondition.findMany).toHaveBeenCalledWith({
      where: { transactionFileId: "tf1" },
      orderBy: { dueDate: "asc" },
    });
  });

  it("returns 404 when the transaction file does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(null);

    const res = await GET(new Request("http://localhost"), { params: { id: "tf1" } });
    expect(res.status).toBe(404);
  });

  it("returns 403 when the requester doesn't own the transaction file", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u2", role: "AGENT", agentId: "a2" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1" } as any);

    const res = await GET(new Request("http://localhost"), { params: { id: "tf1" } });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/transactions/[id]/conditions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a condition under a transaction file", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1" } as any);
    vi.mocked(prisma.fileCondition.create).mockResolvedValue({
      id: "c1",
      transactionFileId: "tf1",
      name: "Inspection Contingency",
      dueDate: new Date("2026-08-01"),
      notes: "17 days after acceptance",
      createdAt: new Date(),
    } as any);

    const res = await POST(
      makeRequest({ name: "Inspection Contingency", dueDate: "2026-08-01", notes: "17 days after acceptance" }),
      { params: { id: "tf1" } }
    );
    expect(res.status).toBe(201);
    expect(prisma.fileCondition.create).toHaveBeenCalledWith({
      data: {
        transactionFileId: "tf1",
        name: "Inspection Contingency",
        dueDate: new Date("2026-08-01"),
        notes: "17 days after acceptance",
      },
    });
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(makeRequest({ name: "x" }), { params: { id: "tf1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the transaction file does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(null);

    const res = await POST(makeRequest({ name: "x" }), { params: { id: "tf1" } });
    expect(res.status).toBe(404);
  });

  it("returns 403 when the requester doesn't own the transaction file", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u2", role: "AGENT", agentId: "a2" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1" } as any);

    const res = await POST(makeRequest({ name: "x" }), { params: { id: "tf1" } });
    expect(res.status).toBe(403);
  });

  it("returns 400 when name is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1" } as any);

    const res = await POST(makeRequest({ notes: "no name provided" }), { params: { id: "tf1" } });
    expect(res.status).toBe(400);
  });

  it("returns 400 when request body is malformed JSON", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1" } as any);

    const res = await POST(
      new Request("http://localhost", { method: "POST", body: "not-valid-json", headers: { "Content-Type": "application/json" } }),
      { params: { id: "tf1" } }
    );
    expect(res.status).toBe(400);
  });

  it("ADMIN can create a condition on any agent's file", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u3", role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1" } as any);
    vi.mocked(prisma.fileCondition.create).mockResolvedValue({ id: "c2", transactionFileId: "tf1", name: "x", dueDate: null, notes: null, createdAt: new Date() } as any);

    const res = await POST(makeRequest({ name: "x" }), { params: { id: "tf1" } });
    expect(res.status).toBe(201);
  });
});
