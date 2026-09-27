import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    transactionFile: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    agent: { findUnique: vi.fn() },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));
vi.mock("@/lib/email/transaction-emails", () => ({ sendFileClosed: vi.fn(), sendCancellationRequested: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/auto-status", async (orig) => ({ ...(await orig<typeof import("@/lib/auto-status")>()), followDates: vi.fn() }));
vi.mock("@/lib/file-status", async (orig) => ({ ...(await orig<typeof import("@/lib/file-status")>()), maybeAutoPending: vi.fn() }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, PATCH } from "../../app/api/transactions/[id]/route";
import { followDates } from "@/lib/auto-status";
import { sendCancellationRequested } from "@/lib/email/transaction-emails";
import { maybeAutoPending } from "@/lib/file-status";

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

const ADMIN_SESSION = { user: { id: "admin1", role: "ADMIN", agentId: null } };
const REFERRAL_TX = { id: "tf1", agentId: "a1", transactionSide: "REFERRAL", status: "REFERRAL_SUCCESSFUL", propertyAddress: null, checklistItems: [] };

describe("PATCH /api/transactions/[id] — referral amount entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  });

  it("computes and stores referralCncFee server-side when entering REFERRAL_BROKER_REVIEW", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(REFERRAL_TX as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ ...REFERRAL_TX, status: "REFERRAL_BROKER_REVIEW" } as any);

    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "REFERRAL_BROKER_REVIEW", referralAmountReceived: 5000 }),
      }),
      { params: { id: "tf1" } }
    );

    expect(res.status).toBe(200);
    expect(prisma.transactionFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REFERRAL_BROKER_REVIEW",
          referralAmountReceived: 5000,
          referralCncFee: 500,
        }),
      })
    );
  });

  it("ignores a client-supplied referralCncFee and always recomputes it", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(REFERRAL_TX as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({} as any);

    await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "REFERRAL_BROKER_REVIEW", referralAmountReceived: 1000, referralCncFee: 1 }),
      }),
      { params: { id: "tf1" } }
    );

    expect(prisma.transactionFile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ referralCncFee: 200 }) })
    );
  });
});

describe("PATCH /api/transactions/[id] — full referral lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  });

  const AGENT_SESSION = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

  function patchRequest(status: string, extra: Record<string, unknown> = {}) {
    return new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ status, ...extra }),
    });
  }

  it("walks a referral file through the entire lifecycle: agent marks successful -> admin enters amount -> admin closes", async () => {
    // Step 1: agent moves PENDING -> REFERRAL_SUCCESSFUL
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({
      id: "tf1",
      agentId: "a1",
      status: "PENDING",
      checklistItems: [],
    } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValueOnce({
      id: "tf1",
      agentId: "a1",
      status: "REFERRAL_SUCCESSFUL",
    } as any);

    const res1 = await PATCH(patchRequest("REFERRAL_SUCCESSFUL"), { params: { id: "tf1" } });
    expect(res1.status).toBe(200);
    expect(prisma.transactionFile.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REFERRAL_SUCCESSFUL" }) })
    );

    // Step 2: admin enters the referral amount -> REFERRAL_BROKER_REVIEW, fee computed server-side
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({
      id: "tf1",
      agentId: "a1",
      status: "REFERRAL_SUCCESSFUL",
      checklistItems: [],
    } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValueOnce({
      id: "tf1",
      agentId: "a1",
      status: "REFERRAL_BROKER_REVIEW",
    } as any);

    const res2 = await PATCH(
      patchRequest("REFERRAL_BROKER_REVIEW", { referralAmountReceived: 5000 }),
      { params: { id: "tf1" } }
    );
    expect(res2.status).toBe(200);
    expect(prisma.transactionFile.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REFERRAL_BROKER_REVIEW",
          referralAmountReceived: 5000,
          referralCncFee: 500,
        }),
      })
    );

    // Step 3: admin closes the file -> CLOSED, close-notification email sent
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({
      id: "tf1",
      agentId: "a1",
      status: "REFERRAL_BROKER_REVIEW",
      checklistItems: [],
      propertyAddress: null,
    } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValueOnce({
      id: "tf1",
      agentId: "a1",
      status: "CLOSED",
    } as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValueOnce({
      id: "a1",
      user: { email: "agent@example.com", name: "Jane Outbound" },
    } as any);

    const res3 = await PATCH(patchRequest("CLOSED"), { params: { id: "tf1" } });
    expect(res3.status).toBe(200);
    expect(prisma.transactionFile.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CLOSED" }) })
    );

    const { sendFileClosed } = await import("@/lib/email/transaction-emails");
    expect(sendFileClosed).toHaveBeenCalledWith(
      expect.objectContaining({ agentEmail: "agent@example.com", fileId: "tf1" })
    );

    // 3 status-change activity log entries were recorded across the whole lifecycle
    expect(prisma.fileActivity.create).toHaveBeenCalledTimes(3);
  });

  it("rejects an agent attempting an admin-only transition (REFERRAL_SUCCESSFUL -> REFERRAL_BROKER_REVIEW)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({
      id: "tf1",
      agentId: "a1",
      status: "REFERRAL_SUCCESSFUL",
      checklistItems: [],
    } as any);

    const res = await PATCH(
      patchRequest("REFERRAL_BROKER_REVIEW", { referralAmountReceived: 5000 }),
      { params: { id: "tf1" } }
    );

    expect(res.status).toBe(400);
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });
});

const AGENT_SESSION = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const okReq = (body: unknown) =>
  new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const READY_ITEMS = [{ isRequired: true, documents: [{ reviewStatus: "APPROVED" }] }];
const NOT_READY_ITEMS = [{ isRequired: true, documents: [{ reviewStatus: "PENDING_REVIEW" }] }];

describe("PATCH /api/transactions/[id] — closed-file lock", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["CLOSED", "ARCHIVED", "CANCELED_APPROVED"])("returns 403 for an agent editing a transaction that is %s", async (status) => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status } as any);
    const res = await PATCH(okReq({ salePrice: "999" }), { params: { id: "tf1" } });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("This file is closed and can't be changed");
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });

  it("lets an admin edit a closed transaction", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "CLOSED" } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1" } as any);
    const res = await PATCH(okReq({ commissionNotes: "fixed" }), { params: { id: "tf1" } });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/transactions/[id] — shared status rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  });

  it("refuses to close without every required document approved, and writes nothing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "PENDING", checklistItems: NOT_READY_ITEMS } as any);
    const res = await PATCH(okReq({ status: "CLOSED", salePrice: "900000" }), { params: { id: "tf1" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Cannot close: not all required documents are approved");
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });

  it("clears Awaiting Review when an admin changes the status through PATCH", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "PENDING", checklistItems: READY_ITEMS } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1", status: "EXPIRED" } as any);
    await PATCH(okReq({ status: "EXPIRED" }), { params: { id: "tf1" } });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "EXPIRED", awaitingReview: false }),
    }));
  });

  it("does a plain field update when the status is unchanged", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "PENDING", checklistItems: READY_ITEMS } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1" } as any);
    await PATCH(okReq({ commissionNotes: "note" }), { params: { id: "tf1" } });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({ where: { id: "tf1" }, data: { commissionNotes: "note" } });
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
  });

  it("ignores awaitingReview in an agent PATCH body", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "PENDING", checklistItems: READY_ITEMS } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1" } as any);
    await PATCH(okReq({ commissionNotes: "x", awaitingReview: false }), { params: { id: "tf1" } });
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({ where: { id: "tf1" }, data: { commissionNotes: "x" } });
  });

  it("does not let an agent clear awaitingReview while changing status", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT_SESSION as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "PENDING", checklistItems: READY_ITEMS } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1", status: "CANCELED_PENDING" } as any);
    // A cancellation request needs a reason (Plan 2); this test is about awaitingReview.
    const res = await PATCH(okReq({ status: "CANCELED_PENDING", cancellationReason: "Deal fell through", awaitingReview: false }), { params: { id: "tf1" } });
    expect(res.status).toBe(200);
    const data = vi.mocked(prisma.transactionFile.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(data.status).toBe("CANCELED_PENDING");
    expect("awaitingReview" in data).toBe(false);
  });
});

describe("PATCH /api/transactions/[id] — optional text fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  });

  it("stores cleared commission notes as null, not an empty string", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "PENDING" } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1" } as any);

    const res = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ commissionNotes: "" }) }),
      { params: { id: "tf1" } }
    );

    expect(res.status).toBe(200);
    const data = vi.mocked(prisma.transactionFile.update).mock.calls[0][0].data as any;
    expect(data.commissionNotes).toBeNull();
  });
});

describe("PATCH /api/transactions/[id] — detail edits", () => {
  const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
  const patch = (body: unknown) => PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) }), { params: { id: "tf1" } });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ id: "tf1", agentId: "a1", status: "INCOMPLETE", transactionSide: "LISTING" } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1" } as any);
  });

  it("saves any editable field (parsed), and ignores fields that aren't editable", async () => {
    expect((await patch({ deposit: "25000", acceptanceDate: "2026-09-20", transactionSide: "DUAL" })).status).toBe(200);
    expect(prisma.transactionFile.update).toHaveBeenCalledWith({ where: { id: "tf1" }, data: { deposit: 25000, acceptanceDate: new Date("2026-09-20") } });
  });

  it("won't clear a required field", async () => {
    const res = await patch({ salePrice: "" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Sale Price can't be blank");
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });

  it("after saving, lets the dates move the status, then re-checks automatic Pending", async () => {
    await patch({ closeOfEscrow: "2026-10-20" });
    const actor = { userId: "u1", role: "AGENT" };
    expect(followDates).toHaveBeenCalledWith("transaction", "tf1", actor);
    expect(maybeAutoPending).toHaveBeenCalledWith("tf1", actor);
  });
});

describe("PATCH /api/transactions/[id] — cancellation requests", () => {
  const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1", name: "Ann Agent" } };
  const patch = (body: unknown) => PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) }), { params: { id: "tf1" } });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({
      id: "tf1", agentId: "a1", status: "PENDING", transactionSide: "PURCHASE", propertyAddress: "1 Main St", checklistItems: [], parties: [],
    } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1", status: "CANCELED_PENDING" } as any);
    vi.mocked(prisma.fileActivity.create).mockResolvedValue({} as any);
  });

  it("requires a reason from an agent", async () => {
    const res = await patch({ status: "CANCELED_PENDING", cancellationReason: "  " });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Please give a reason for the cancellation");
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });

  it("logs the reason with the status change and emails the broker", async () => {
    const res = await patch({ status: "CANCELED_PENDING", cancellationReason: "Buyer's financing fell through" });
    expect(res.status).toBe(200);
    expect(prisma.fileActivity.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      type: "STATUS_CHANGED", payload: { from: "PENDING", to: "CANCELED_PENDING", reason: "Buyer's financing fell through" },
    }) });
    expect(sendCancellationRequested).toHaveBeenCalledWith(expect.objectContaining({
      address: "1 Main St", agentName: "Ann Agent", reason: "Buyer's financing fell through", fileId: "tf1",
    }));
  });
});

describe("PATCH /api/transactions/[id] — commission edits", () => {
  const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
  const patch = (body: unknown) => PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) }), { params: { id: "tf1" } });
  const PURCHASE = { id: "tf1", agentId: "a1", status: "PRE_CONTRACT", transactionSide: "PURCHASE", salePrice: 500000 };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(PURCHASE as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ id: "tf1" } as any);
  });

  it("saves a commission % and recomputes the $ amount and GCI the Commission tab reads", async () => {
    expect((await patch({ saleCommissionPct: "3", saleCommissionAmount: "" })).status).toBe(200);
    const data = vi.mocked(prisma.transactionFile.update).mock.calls[0][0].data as any;
    expect(data).toMatchObject({ saleCommissionPct: 3, saleCommissionAmount: 15000, commissionGCI: 15000 });
  });

  it("rejects a commission % over 100", async () => {
    const res = await patch({ saleCommissionPct: "15000", saleCommissionAmount: "" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Commission can't be more than 100%");
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });

  it("won't clear the commission once past Pre-Contract", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ ...PURCHASE, status: "PENDING", saleCommissionPct: 2.5 } as any);
    const res = await patch({ saleCommissionPct: "", saleCommissionAmount: "" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Selling Agent Commission can't be blank");
  });
});

describe("PATCH /api/transactions/[id] — commission review lock + change log", () => {
  const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
  const ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: null } };
  const patch = (body: unknown) => PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) }), { params: { id: "tf1" } });
  const BEFORE = {
    id: "tf1", agentId: "a1", status: "PENDING", awaitingReview: false, transactionSide: "PURCHASE", salePrice: 500000,
    saleCommissionPct: 2.5, saleCommissionAmount: 12500, listingCommissionPct: null, listingCommissionAmount: null,
  };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(BEFORE as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ ...BEFORE, saleCommissionPct: 3, saleCommissionAmount: 15000 } as any);
  });

  it("logs the change to the Activity tab (old -> new, who)", async () => {
    expect((await patch({ saleCommissionPct: "3", saleCommissionAmount: "" })).status).toBe(200);
    expect(prisma.fileActivity.create).toHaveBeenCalledWith({
      data: {
        fileType: "TRANSACTION", transactionFileId: "tf1", actorId: "u1", actorRole: "AGENT", type: "COMMISSION_CHANGED",
        payload: { changes: [{ label: "Selling Agent Commission", from: "2.5%", to: "3%" }] },
      },
    });
  });

  it("refuses an agent's commission edit while Awaiting Review", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ ...BEFORE, awaitingReview: true } as any);
    const res = await patch({ saleCommissionPct: "3", saleCommissionAmount: "" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Commission is locked while this file is in broker review");
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });

  it("still lets the agent edit other details during review", async () => {
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ ...BEFORE, awaitingReview: true } as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue({ ...BEFORE, awaitingReview: true } as any);
    expect((await patch({ escrowNumber: "E-1" })).status).toBe(200);
    expect(prisma.fileActivity.create).not.toHaveBeenCalled();
  });

  it("lets the broker change it during review, logged as the broker", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ ...BEFORE, awaitingReview: true } as any);
    expect((await patch({ saleCommissionPct: "3", saleCommissionAmount: "" })).status).toBe(200);
    expect(prisma.fileActivity.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: "admin1", actorRole: "ADMIN" }) });
  });
});

describe("PATCH /api/transactions/[id] — Pending dates and date order", () => {
  const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
  const patch = (body: unknown) => PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) }), { params: { id: "tf1" } });
  const PENDING = {
    id: "tf1", agentId: "a1", status: "PENDING", transactionSide: "PURCHASE", salePrice: 500000, saleCommissionPct: 2.5,
    acceptanceDate: new Date("2026-09-20"), closeOfEscrow: new Date("2026-10-20"),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(PENDING as any);
    vi.mocked(prisma.transactionFile.update).mockResolvedValue(PENDING as any);
  });

  it("won't clear Close of Escrow on a Pending file", async () => {
    const res = await patch({ closeOfEscrow: "" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Close of Escrow can't be blank");
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });

  it("refuses a Close of Escrow before the saved Acceptance Date", async () => {
    const res = await patch({ closeOfEscrow: "2026-09-01" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Close of Escrow can't be before the Acceptance Date");
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });

  it("allows moving the date to a valid one", async () => {
    expect((await patch({ closeOfEscrow: "2026-11-15" })).status).toBe(200);
  });
});
