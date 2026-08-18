import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { agent: { updateMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import {
  nextMonthBoundary,
  remainingQuota,
  ensureQuotaReset,
  tryConsumeEmailQuota,
} from "@/lib/email-quota";

describe("nextMonthBoundary", () => {
  it("returns the 1st of the following UTC month at midnight", () => {
    const now = new Date("2026-08-17T14:32:00.000Z");
    expect(nextMonthBoundary(now)).toEqual(new Date("2026-09-01T00:00:00.000Z"));
  });

  it("rolls over the year at December", () => {
    const now = new Date("2026-12-15T00:00:00.000Z");
    expect(nextMonthBoundary(now)).toEqual(new Date("2027-01-01T00:00:00.000Z"));
  });

  it("a reset triggered exactly on the 1st lands on the following month, not the same day", () => {
    const now = new Date("2026-09-01T00:00:00.000Z");
    expect(nextMonthBoundary(now)).toEqual(new Date("2026-10-01T00:00:00.000Z"));
  });
});

describe("remainingQuota", () => {
  const now = new Date("2026-08-17T00:00:00.000Z");

  it("returns limit minus sent when the boundary hasn't passed", () => {
    const agent = {
      monthlyEmailLimit: 200,
      monthlyEmailsSent: 58,
      monthlyResetAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    expect(remainingQuota(agent, now)).toBe(142);
  });

  it("returns the full limit once the boundary has passed, ignoring stale sent count", () => {
    const agent = {
      monthlyEmailLimit: 200,
      monthlyEmailsSent: 200,
      monthlyResetAt: new Date("2026-08-01T00:00:00.000Z"),
    };
    expect(remainingQuota(agent, now)).toBe(200);
  });

  it("clamps at 0, never negative", () => {
    const agent = {
      monthlyEmailLimit: 200,
      monthlyEmailsSent: 250,
      monthlyResetAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    expect(remainingQuota(agent, now)).toBe(0);
  });

  it("treats a boundary equal to now as passed", () => {
    const agent = {
      monthlyEmailLimit: 200,
      monthlyEmailsSent: 200,
      monthlyResetAt: now,
    };
    expect(remainingQuota(agent, now)).toBe(200);
  });
});

describe("ensureQuotaReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resets the counter and advances monthlyResetAt when the boundary has passed", async () => {
    vi.mocked(prisma.agent.updateMany).mockResolvedValue({ count: 1 } as any);
    const now = new Date("2026-09-05T00:00:00.000Z");

    await ensureQuotaReset("agent-1", now);

    expect(prisma.agent.updateMany).toHaveBeenCalledWith({
      where: { id: "agent-1", monthlyResetAt: { lte: now } },
      data: { monthlyEmailsSent: 0, monthlyResetAt: new Date("2026-10-01T00:00:00.000Z") },
    });
  });

  it("is a harmless no-op (still called, matched zero rows) when the boundary hasn't passed", async () => {
    vi.mocked(prisma.agent.updateMany).mockResolvedValue({ count: 0 } as any);
    await expect(ensureQuotaReset("agent-1", new Date())).resolves.toBeUndefined();
  });
});

describe("tryConsumeEmailQuota", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when the atomic increment matched a row (quota was available)", async () => {
    vi.mocked(prisma.agent.updateMany).mockResolvedValue({ count: 1 } as any);

    const ok = await tryConsumeEmailQuota("agent-1", 200);

    expect(ok).toBe(true);
    expect(prisma.agent.updateMany).toHaveBeenCalledWith({
      where: { id: "agent-1", monthlyEmailsSent: { lt: 200 } },
      data: { monthlyEmailsSent: { increment: 1 } },
    });
  });

  it("returns false when the agent was already at their limit", async () => {
    vi.mocked(prisma.agent.updateMany).mockResolvedValue({ count: 0 } as any);
    const ok = await tryConsumeEmailQuota("agent-1", 200);
    expect(ok).toBe(false);
  });
});
