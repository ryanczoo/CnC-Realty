import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/r2", () => ({ deleteR2Object: vi.fn() }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendFileClosed: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    agent: { findUnique: vi.fn() },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PATCH } from "../../app/api/listings/[id]/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: null } };
const patch = (body: unknown) =>
  PATCH(new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), { params: { id: "lf1" } });
const READY = [{ isRequired: true, documents: [{ reviewStatus: "APPROVED" }] }];
const NOT_READY = [{ isRequired: true, documents: [{ reviewStatus: "PENDING_REVIEW" }] }];

describe("PATCH /api/listings/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ user: { email: "a@x.com", name: "Ann" } } as any);
  });

  it.each(["CLOSED", "CANCELED"])("returns 403 for an agent editing a listing that is %s", async (status) => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status } as any);
    const res = await patch({ listPrice: "1" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("This file is closed and can't be changed");
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("lets an admin edit a closed listing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status: "CLOSED" } as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1" } as any);
    expect((await patch({ commissionNotes: "x" })).status).toBe(200);
  });

  it("refuses to close without every required document approved", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status: "ACTIVE", checklistItems: NOT_READY } as any);
    const res = await patch({ status: "CLOSED" });
    expect(res.status).toBe(400);
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("changes status through the shared function, clearing Awaiting Review for an admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status: "ACTIVE", checklistItems: READY } as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1", status: "EXPIRED" } as any);
    const res = await patch({ status: "EXPIRED", listPrice: "500000" });
    expect(res.status).toBe(200);
    expect(prisma.listingFile.update).toHaveBeenCalledWith({
      where: { id: "lf1" },
      data: { listPrice: 500000, status: "EXPIRED", awaitingReview: false },
    });
  });

  it("ignores awaitingReview in an agent PATCH body", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status: "ACTIVE", checklistItems: READY } as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1" } as any);
    await patch({ commissionNotes: "x", awaitingReview: false });
    expect(prisma.listingFile.update).toHaveBeenCalledWith({ where: { id: "lf1" }, data: { commissionNotes: "x" } });
  });

  it("does not let an agent clear awaitingReview while changing status", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status: "ACTIVE", checklistItems: READY } as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1", status: "WITHDRAWN" } as any);
    const res = await patch({ status: "WITHDRAWN", awaitingReview: false });
    expect(res.status).toBe(200);
    const data = vi.mocked(prisma.listingFile.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(data.status).toBe("WITHDRAWN");
    expect("awaitingReview" in data).toBe(false);
  });
});
