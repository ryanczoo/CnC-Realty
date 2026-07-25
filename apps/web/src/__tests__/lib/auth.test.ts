import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
  },
}));

vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn() } }));
vi.mock("next-auth/providers/credentials", () => ({ default: vi.fn(() => ({})) }));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn(() => ({})) }));

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

describe("auth jwt/session callbacks — agentId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks up and stores agentId on the token at sign-in", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: "agent-1" } as any);

    const before = Date.now();
    const token = await authOptions.callbacks!.jwt!({
      token: {},
      user: { id: "user-1", email: "a@b.com", name: "A", role: "AGENT" } as any,
      account: null,
      profile: undefined,
      trigger: "signIn",
    } as any);

    expect(prisma.agent.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { id: true },
    });
    expect((token as any).agentId).toBe("agent-1");
    expect((token as any).agentIdCheckedAt).toBeGreaterThanOrEqual(before);
  });

  it("stores agentId: null for a user with no agent record", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);

    const token = await authOptions.callbacks!.jwt!({
      token: {},
      user: { id: "user-2", email: "b@c.com", name: "B", role: "BUYER" } as any,
      account: null,
      profile: undefined,
      trigger: "signIn",
    } as any);

    expect((token as any).agentId).toBe(null);
  });

  it("does not re-query the DB on token refresh when recently checked", async () => {
    const token = await authOptions.callbacks!.jwt!({
      token: { id: "user-1", role: "AGENT", agentId: "agent-1", agentIdCheckedAt: Date.now() - 60_000 },
      user: undefined,
      account: null,
      profile: undefined,
      trigger: undefined,
    } as any);

    expect(prisma.agent.findUnique).not.toHaveBeenCalled();
    expect((token as any).agentId).toBe("agent-1");
  });

  it("re-queries the DB and updates agentId when the check is older than the refresh interval", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: "agent-2" } as any);
    const staleCheckedAt = Date.now() - 11 * 60 * 1000; // 11 minutes ago

    const token = await authOptions.callbacks!.jwt!({
      token: { id: "user-1", role: "ADMIN", agentId: null, agentIdCheckedAt: staleCheckedAt },
      user: undefined,
      account: null,
      profile: undefined,
      trigger: undefined,
    } as any);

    expect(prisma.agent.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { id: true },
    });
    expect((token as any).agentId).toBe("agent-2");
  });

  it("refreshes agentIdCheckedAt after a stale re-check", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: "agent-2" } as any);
    const staleCheckedAt = Date.now() - 11 * 60 * 1000;
    const before = Date.now();

    const token = await authOptions.callbacks!.jwt!({
      token: { id: "user-1", role: "ADMIN", agentId: null, agentIdCheckedAt: staleCheckedAt },
      user: undefined,
      account: null,
      profile: undefined,
      trigger: undefined,
    } as any);

    expect((token as any).agentIdCheckedAt).toBeGreaterThanOrEqual(before);
  });

  it("treats a token with no agentIdCheckedAt at all as stale and re-queries", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: "agent-3" } as any);

    const token = await authOptions.callbacks!.jwt!({
      token: { id: "user-1", role: "AGENT", agentId: "agent-old" },
      user: undefined,
      account: null,
      profile: undefined,
      trigger: undefined,
    } as any);

    expect(prisma.agent.findUnique).toHaveBeenCalled();
    expect((token as any).agentId).toBe("agent-3");
  });

  it("exposes agentId on the session from the token", async () => {
    const session = await authOptions.callbacks!.session!({
      session: { user: {}, expires: "" } as any,
      token: { id: "user-1", role: "AGENT", agentId: "agent-1" } as any,
      user: undefined as any,
    } as any);

    expect((session.user as any).agentId).toBe("agent-1");
  });
});
