import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/r2", () => ({ deleteR2Object: vi.fn() }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendFileClosed: vi.fn() }));
vi.mock("@/lib/auto-status", async (orig) => ({ ...(await orig<typeof import("@/lib/auto-status")>()), followDates: vi.fn() }));
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
import { followDates } from "@/lib/auto-status";

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

  it("stores a cleared MLS number and commission notes as null, not empty strings", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status: "ACTIVE" } as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1" } as any);
    expect((await patch({ mlsNumber: "", commissionNotes: "" })).status).toBe(200);
    const data = vi.mocked(prisma.listingFile.update).mock.calls[0][0].data as any;
    expect(data.mlsNumber).toBeNull();
    expect(data.commissionNotes).toBeNull();
  });

  describe("list/expiration dates", () => {
    const STORED = { id: "lf1", agentId: "a1", status: "ACTIVE", listDate: new Date("2026-09-24T00:00:00.000Z"), expirationDate: new Date("2027-03-24T00:00:00.000Z") };
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
      vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(STORED as any);
      vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1" } as any);
    });

    it.each(["listDate", "expirationDate"])("returns 400 when %s is cleared", async (field) => {
      const res = await patch({ [field]: "" });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("List date and expiration date are required");
      expect(prisma.listingFile.update).not.toHaveBeenCalled();
    });

    it("returns 400 when a new expiration is before the stored list date", async () => {
      const res = await patch({ expirationDate: "2026-09-01" });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Expiration date can't be before the list date");
      expect(prisma.listingFile.update).not.toHaveBeenCalled();
    });

    it("returns 400 when a new list date is after the stored expiration", async () => {
      const res = await patch({ listDate: "2027-04-01" });
      expect(res.status).toBe(400);
      expect(prisma.listingFile.update).not.toHaveBeenCalled();
    });

    it("accepts a valid date change", async () => {
      expect((await patch({ expirationDate: "2027-06-30" })).status).toBe(200);
      const data = vi.mocked(prisma.listingFile.update).mock.calls[0][0].data as any;
      expect(data.expirationDate).toEqual(new Date("2027-06-30"));
    });

    it("does not block edits that don't touch dates on an older listing with no dates", async () => {
      vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ ...STORED, listDate: null, expirationDate: null } as any);
      expect((await patch({ commissionNotes: "x" })).status).toBe(200);
    });
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

describe("PATCH /api/listings/[id] — detail edits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status: "EXPIRED", listDate: new Date("2026-01-01"), expirationDate: new Date("2026-06-01") } as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1" } as any);
  });

  it("won't clear a required field", async () => {
    const res = await patch({ listPrice: "" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("List Price can't be blank");
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("after saving, lets the dates move the status (e.g. an extended Expired listing)", async () => {
    await patch({ expirationDate: "2027-06-01" });
    expect(followDates).toHaveBeenCalledWith("listing", "lf1", { userId: "u1", role: "AGENT" });
  });
});

describe("PATCH /api/listings/[id] — commission as % or $", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status: "ACTIVE" } as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1" } as any);
  });

  it("switching to a flat amount clears the percentage (and blanks become null)", async () => {
    await patch({ commissionAmount: "15000", commissionPercent: "" });
    const data = vi.mocked(prisma.listingFile.update).mock.calls[0][0].data as any;
    expect(data.commissionAmount).toBe(15000);
    expect(data.commissionPercent).toBeNull();
  });
});
