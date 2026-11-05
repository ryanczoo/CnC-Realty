import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/year-checklist-db", () => ({ applyPropertyFacts: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/r2", () => ({ deleteR2Object: vi.fn() }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendFileClosed: vi.fn(), sendCommissionChangeRequest: vi.fn() }));
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
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { PATCH } from "../../app/api/listings/[id]/route";
import { followDates } from "@/lib/auto-status";
import { AGENT_VIEW_HEADER } from "@/lib/agent-view";

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

describe("PATCH /api/listings/[id] — commission % can't exceed 100", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status: "ACTIVE" } as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1" } as any);
  });

  it("rejects a commission % over 100", async () => {
    const res = await patch({ commissionPercent: "15000", commissionAmount: "" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Commission can't be more than 100%");
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it.each(["abc", "Infinity"])("rejects a non-numeric commission (%s)", async (bad) => {
    const res = await patch({ commissionPercent: bad, commissionAmount: "" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Commission must be a number");
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/listings/[id] — commission review lock + change log", () => {
  const BEFORE = { id: "lf1", agentId: "a1", status: "ACTIVE", awaitingReview: false, commissionPercent: 2.5, commissionAmount: null };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(BEFORE as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ ...BEFORE, commissionPercent: null, commissionAmount: 15000 } as any);
  });

  it("logs the change to the Activity tab (old -> new, who)", async () => {
    expect((await patch({ commissionAmount: "15000", commissionPercent: "" })).status).toBe(200);
    expect(prisma.fileActivity.create).toHaveBeenCalledWith({
      data: {
        fileType: "LISTING", listingFileId: "lf1", actorId: "u1", actorRole: "AGENT", type: "COMMISSION_CHANGED",
        payload: { changes: [{ label: "Commission", from: "2.5%", to: "$15,000" }] },
      },
    });
  });

  it("doesn't log when commission didn't change", async () => {
    vi.mocked(prisma.listingFile.update).mockResolvedValue(BEFORE as any);
    await patch({ city: "Irvine" });
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
  });

  it("refuses an agent's commission edit while Awaiting Review", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ ...BEFORE, awaitingReview: true } as any);
    const res = await patch({ commissionAmount: "15000", commissionPercent: "" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Commission is locked while this file is in broker review");
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("lets the broker change it during review", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ ...BEFORE, awaitingReview: true } as any);
    expect((await patch({ commissionAmount: "15000", commissionPercent: "" })).status).toBe(200);
  });
});

describe("PATCH /api/listings/[id] — Year Built and Property Type", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "lf1", agentId: "a1", status: "ACTIVE", propertyType: "Condo", yearBuilt: 2005 } as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1" } as any);
  });
  it("saves the year and re-checks the linked files", async () => {
    const { applyPropertyFacts } = await import("@/lib/year-checklist-db");
    const res = await patch({ yearBuilt: "1952" });
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.listingFile.update).mock.calls[0][0].data).toMatchObject({ yearBuilt: 1952 });
    expect(applyPropertyFacts).toHaveBeenCalledWith("listing", "lf1", { yearBuilt: 1952 }, { userId: "u1", role: "AGENT" });
  });
  it("saves a property type", async () => {
    const { applyPropertyFacts } = await import("@/lib/year-checklist-db");
    await patch({ propertyType: "Land" });
    expect(vi.mocked(prisma.listingFile.update).mock.calls[0][0].data).toMatchObject({ propertyType: "Land" });
    expect(applyPropertyFacts).toHaveBeenCalledWith("listing", "lf1", { propertyType: "Land" }, { userId: "u1", role: "AGENT" });
  });
  it("does not re-check when the value didn't change", async () => {
    const { applyPropertyFacts } = await import("@/lib/year-checklist-db");
    await patch({ yearBuilt: "2005" });
    expect(applyPropertyFacts).not.toHaveBeenCalled();
  });
  it("refuses a blank or out-of-range year", async () => {
    expect((await patch({ yearBuilt: "" })).status).toBe(400);
    expect((await patch({ yearBuilt: "3000" })).status).toBe(400);
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/listings/[id] - commission change after broker review", () => {
  const REVIEWED = {
    id: "lf1", agentId: "a1", status: "ACTIVE", propertyAddress: "12 Oak St",
    awaitingReview: false, reviewSubmittedAt: new Date("2026-10-01T00:00:00.000Z"), pendingCommission: null,
    commissionPercent: 2.5, commissionAmount: null, checklistItems: [],
  };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(REVIEWED as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ user: { email: "a@x.com", name: "Ann" } } as any);
  });

  it("a plain save writes the new commission and the re-flag in ONE update", async () => {
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ ...REVIEWED, commissionPercent: 2, awaitingReview: true } as any);
    const res = await patch({ commissionPercent: "2" });
    expect(res.status).toBe(200);
    expect(prisma.listingFile.update).toHaveBeenCalledTimes(1);
    const data = vi.mocked(prisma.listingFile.update).mock.calls[0][0].data as any;
    expect(data.commissionPercent).toBe(2);
    expect(data.awaitingReview).toBe(true);
    expect(data.pendingCommission.before.commissionPercent).toBe(2.5);
    expect((await res.json()).listing.awaitingReview).toBe(true);
  });

  it("applies the status change, then sends the file back to the broker, in one response", async () => {
    vi.mocked(prisma.listingFile.update)
      .mockResolvedValueOnce({ ...REVIEWED, status: "COMING_SOON", commissionPercent: 2 } as any)
      .mockResolvedValueOnce({ ...REVIEWED, status: "COMING_SOON", commissionPercent: 2, awaitingReview: true } as any);
    const res = await patch({ commissionPercent: "2", status: "COMING_SOON" });
    expect(res.status).toBe(200);
    const calls = vi.mocked(prisma.listingFile.update).mock.calls;
    expect((calls[0][0].data as any).status).toBe("COMING_SOON");
    expect(calls[1][0]).toMatchObject({ where: { id: "lf1" }, data: { awaitingReview: true } });
    expect(((calls[1][0].data as any).pendingCommission).before.commissionPercent).toBe(2.5);
    const body = await res.json();
    expect(body.listing.awaitingReview).toBe(true);
    expect(body.listing.status).toBe("COMING_SOON");
  });

  it("reports an error, not a silent 200, when the re-flag write fails after a status change", async () => {
    vi.mocked(prisma.listingFile.update)
      .mockResolvedValueOnce({ ...REVIEWED, status: "COMING_SOON", commissionPercent: 2 } as any)
      .mockRejectedValueOnce(new Error("db down"));
    const res = await patch({ commissionPercent: "2", status: "COMING_SOON" });
    expect(res.status).toBe(500);
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});

// An admin working in the Agent section sends the agent-view marker and is
// treated as an agent: only their own files, and the agent's commission lock.
describe("PATCH /api/listings/[id] — agent-view marker", () => {
  const VIEWING_ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: "a1" } };
  const IN_REVIEW = { id: "lf1", agentId: "a1", status: "ACTIVE", awaitingReview: true };
  const send = (body: unknown, marked: boolean) =>
    PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(marked && { [AGENT_VIEW_HEADER]: "1" }) },
        body: JSON.stringify(body),
      }),
      { params: { id: "lf1" } },
    );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
    vi.mocked(prisma.listingFile.update).mockResolvedValue({ id: "lf1" } as any);
    vi.mocked(getServerSession).mockResolvedValue(VIEWING_ADMIN as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(IN_REVIEW as any);
  });

  it("locks the commission on the admin's own file while it awaits review", async () => {
    const res = await send({ commissionPercent: "3" }, true);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Commission is locked while this file is in broker review");
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });

  it("lets the same admin edit the commission without the marker", async () => {
    expect((await send({ commissionPercent: "3" }, false)).status).toBe(200);
  });

  it("refuses another agent's file with the marker, allows it without", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ ...IN_REVIEW, agentId: "a2", awaitingReview: false } as any);
    expect((await send({ commissionNotes: "x" }, true)).status).toBe(403);
    expect((await send({ commissionNotes: "x" }, false)).status).toBe(200);
  });
});
