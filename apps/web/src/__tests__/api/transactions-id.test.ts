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
import { GET, PATCH } from "../../app/api/transactions/[id]/route";

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
const REFERRAL_TX = { id: "tf1", agentId: "a1", transactionSide: "REFERRAL", status: "REFERRAL_SUCCESSFUL", propertyAddress: null };

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
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValueOnce({
      id: "tf1",
      agentId: "a1",
      status: "PENDING",
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
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValueOnce({
      id: "tf1",
      agentId: "a1",
      status: "REFERRAL_SUCCESSFUL",
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
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValueOnce({
      id: "tf1",
      agentId: "a1",
      status: "REFERRAL_BROKER_REVIEW",
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
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValueOnce({
      id: "tf1",
      agentId: "a1",
      status: "REFERRAL_SUCCESSFUL",
    } as any);

    const res = await PATCH(
      patchRequest("REFERRAL_BROKER_REVIEW", { referralAmountReceived: 5000 }),
      { params: { id: "tf1" } }
    );

    expect(res.status).toBe(400);
    expect(prisma.transactionFile.update).not.toHaveBeenCalled();
  });
});
