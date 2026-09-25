import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: { listingFile: { findMany: vi.fn() }, transactionFile: { findMany: vi.fn() } },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/admin/audit-queue/route";

describe("GET /api/admin/audit-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.listingFile.findMany).mockResolvedValue([]);
    vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([]);
  });

  it("is broker-only", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "AGENT" } } as any);
    expect((await GET()).status).toBe(403);
  });

  it("queues transactions awaiting review AND cancellation requests (Cancel Pending)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "ADMIN" } } as any);
    await GET();
    const where = (vi.mocked(prisma.transactionFile.findMany).mock.calls[0][0] as any).where;
    expect(where).toEqual({ OR: [{ awaitingReview: true }, { status: "CANCELED_PENDING" }] });
    const listingWhere = (vi.mocked(prisma.listingFile.findMany).mock.calls[0][0] as any).where;
    expect(listingWhere).toEqual({ awaitingReview: true });
  });
});
