import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/cron/deadline-reminders/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({ prisma: { transactionFile: { findMany: vi.fn() } } }));
vi.mock("@/lib/deadline-email", () => ({ sendDeadlineReminder: vi.fn() }));
vi.mock("@prisma/client", () => ({
  TransactionFileStatus: { CLOSED: "CLOSED" },
}));

import { prisma } from "@/lib/prisma";
import { sendDeadlineReminder } from "@/lib/deadline-email";

const validSecret = "test-secret";

const makeReq = (secret?: string) =>
  new NextRequest("http://localhost/api/cron/deadline-reminders", {
    method: "POST",
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });

describe("POST /api/cron/deadline-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", validSecret);
  });

  it("returns 401 with wrong secret", async () => {
    const res = await POST(makeReq("wrong"));
    expect(res.status).toBe(401);
  });

  it("sends no emails when no deadlines fall in window", async () => {
    vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([]);
    const res = await POST(makeReq(validSecret));
    expect(res.status).toBe(200);
    expect(sendDeadlineReminder).not.toHaveBeenCalled();
  });

  it("sends email for deadline exactly 1 day out", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([
      {
        id: "t1",
        propertyAddress: "123 Main St",
        closeOfEscrow: tomorrow,
        inspectionDeadline: null,
        appraisalDeadline: null,
        loanApprovalDeadline: null,
        agent: { user: { name: "Test Agent", email: "agent@test.com" } },
      },
    ] as any);
    const res = await POST(makeReq(validSecret));
    expect(res.status).toBe(200);
    expect(sendDeadlineReminder).toHaveBeenCalledTimes(1);
    expect(sendDeadlineReminder).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Close of Escrow", agentEmail: "agent@test.com", daysOut: 1 })
    );
  });
});
