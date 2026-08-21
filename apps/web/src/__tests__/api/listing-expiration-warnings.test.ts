import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/cron/listing-expiration-warnings/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({ prisma: { listingFile: { findMany: vi.fn() } } }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendFileExpirationWarning: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { sendFileExpirationWarning } from "@/lib/email/transaction-emails";

const validSecret = "test-secret";

const makeReq = (secret?: string) =>
  new NextRequest("http://localhost/api/cron/listing-expiration-warnings", {
    method: "POST",
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });

describe("POST /api/cron/listing-expiration-warnings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", validSecret);
  });

  it("returns 401 with wrong secret", async () => {
    const res = await POST(makeReq("wrong"));
    expect(res.status).toBe(401);
    expect(prisma.listingFile.findMany).not.toHaveBeenCalled();
  });

  it("queries only ACTIVE listings within the exact 7-day-out window, not a range", async () => {
    vi.mocked(prisma.listingFile.findMany).mockResolvedValue([]);

    await POST(makeReq(validSecret));

    const arg = vi.mocked(prisma.listingFile.findMany).mock.calls[0][0] as any;
    expect(arg.where.status).toBe("ACTIVE");

    // The window must be a single calendar day (midnight to 23:59:59.999),
    // not "anytime in the next 7 days" -- that's what makes this a one-shot
    // reminder instead of one email per day for a week straight.
    const { gte, lte } = arg.where.expirationDate;
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    expect(gte.toDateString()).toBe(sevenDaysFromNow.toDateString());
    expect(lte.toDateString()).toBe(sevenDaysFromNow.toDateString());
    expect(gte.getHours()).toBe(0);
    expect(lte.getHours()).toBe(23);
  });

  it("sends no emails when no listings fall in the window", async () => {
    vi.mocked(prisma.listingFile.findMany).mockResolvedValue([]);
    const res = await POST(makeReq(validSecret));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0 });
    expect(sendFileExpirationWarning).not.toHaveBeenCalled();
  });

  it("sends exactly one warning per matching listing, to that listing's own agent", async () => {
    vi.mocked(prisma.listingFile.findMany).mockResolvedValue([
      {
        id: "listing-1",
        propertyAddress: "123 Main St",
        agent: { user: { name: "Test Agent", email: "agent@test.com" } },
      },
    ] as any);

    const res = await POST(makeReq(validSecret));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1 });
    expect(sendFileExpirationWarning).toHaveBeenCalledTimes(1);
    expect(sendFileExpirationWarning).toHaveBeenCalledWith({
      agentEmail: "agent@test.com",
      agentName: "Test Agent",
      address: "123 Main St",
      expiresInDays: 7,
      fileType: "listing",
      fileId: "listing-1",
    });
  });

  it("skips a listing whose agent has no linked user email, without crashing the batch", async () => {
    vi.mocked(prisma.listingFile.findMany).mockResolvedValue([
      { id: "listing-1", propertyAddress: "123 Main St", agent: { user: { name: "Has Email", email: "a@test.com" } } },
      { id: "listing-2", propertyAddress: "456 Oak Ave", agent: { user: { name: null, email: null } } },
    ] as any);

    const res = await POST(makeReq(validSecret));

    expect(await res.json()).toEqual({ sent: 1 });
    expect(sendFileExpirationWarning).toHaveBeenCalledTimes(1);
    expect(sendFileExpirationWarning).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: "listing-1" })
    );
  });
});
