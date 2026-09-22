import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendFileClosed: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    transactionFile: { findUnique: vi.fn(), update: vi.fn() },
    listingFile: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PATCH as patchTransaction } from "../../app/api/transactions/[id]/route";
import { PATCH as patchListing } from "../../app/api/listings/[id]/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const json = (body: unknown) =>
  new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
});

describe("PATCH trims whitespace before writing field data", () => {
  it("transactions", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "PENDING" } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1" } as any);
    await patchTransaction(json({ commissionNotes: "  fixed  " }), { params: { id: "tf1" } });
    const data = vi.mocked(prisma.transactionFile.update).mock.calls[0][0].data as any;
    expect(data.commissionNotes).toBe("fixed");
  });

  it("listings", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status: "ACTIVE" } as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1" } as any);
    await patchListing(json({ commissionNotes: "  fixed  " }), { params: { id: "lf1" } });
    const data = vi.mocked(prisma.listingFile.update).mock.calls[0][0].data as any;
    expect(data.commissionNotes).toBe("fixed");
  });
});
