import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/r2", () => ({ deleteR2Object: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { listingFile: { findUnique: vi.fn() } } }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../../app/api/listings/[id]/route";

describe("GET /api/listings/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes the most recent transaction converted from this listing (for View Transaction)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "l1", agentId: "a1", convertedFiles: [{ id: "t1", status: "INCOMPLETE" }] } as any);

    const res = await GET(new Request("http://localhost"), { params: { id: "l1" } });

    expect(res.status).toBe(200);
    expect(prisma.listingFile.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        convertedFiles: { select: { id: true, status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      }),
    }));
  });
});
