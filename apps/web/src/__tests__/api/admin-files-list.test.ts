import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findMany: vi.fn() },
    transactionFile: { findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/admin/files/route";

describe("GET /api/admin/files", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a request with no session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("rejects a non-admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT" } } as any);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(prisma.transactionFile.findMany).not.toHaveBeenCalled();
  });

  it("returns every agent's listings and transactions to an admin, with no per-agent filter", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any);
    vi.mocked(prisma.listingFile.findMany).mockResolvedValue([{ id: "l1" }] as any);
    vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([{ id: "t1" }, { id: "t2" }] as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.listings).toEqual([{ id: "l1" }]);
    expect(body.transactions).toEqual([{ id: "t1" }, { id: "t2" }]);

    const txArgs = vi.mocked(prisma.transactionFile.findMany).mock.calls[0][0] as any;
    const listingArgs = vi.mocked(prisma.listingFile.findMany).mock.calls[0][0] as any;
    expect(txArgs).not.toHaveProperty("where");
    expect(listingArgs).not.toHaveProperty("where");
    expect(txArgs.include.agent.include.user.select).toEqual({ name: true, email: true });
    expect(txArgs.take).toBe(200);
    expect(listingArgs.take).toBe(200);
    expect(txArgs.orderBy).toEqual({ createdAt: "desc" });
    expect(listingArgs.orderBy).toEqual({ createdAt: "desc" });
    expect(listingArgs.include).toEqual(txArgs.include);
    expect(txArgs.include.checklistItems).toEqual({
      select: { isRequired: true, documents: { select: { reviewStatus: true } } },
    });
  });
});
