import { describe, it, expect, vi, beforeEach } from "vitest";

// React's `cache()` is a react-server-only export not present in the plain
// "react" build vitest resolves under environment: "node" — stub it as a
// pass-through so the module under test can be imported at all.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: (fn: unknown) => fn,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    transactionFile: { findMany: vi.fn() },
  },
}));
vi.mock("@/components/agents/AgentProfileHero", () => ({ AgentProfileHero: () => null }));
vi.mock("@/components/agents/AgentContactForm", () => ({ AgentContactForm: () => null }));

import { prisma } from "@/lib/prisma";
import AgentProfilePage from "../../app/(agents)/agents/[slug]/page";

const AGENT = {
  id: "agent-1",
  userId: "user-1",
  slug: "ryan-chong",
  displayName: "Ryan Chong",
  title: null,
  bio: null,
  headshot: null,
  licenseNum: null,
  licenseState: null,
  yearsExp: null,
  specialties: [],
  phone: null,
  instagram: null,
  facebook: null,
  location: null,
  language: null,
  user: { email: "ryan@example.com" },
  listingsClosed: 0,
  volumeClosed: 0,
  propertiesRented: 0,
} as any;

describe("AgentProfilePage — public Transactions section", () => {
  beforeEach(() => vi.clearAllMocks());

  it("excludes REFERRAL-side files, since referring a client out isn't a transaction the agent personally closed", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(AGENT);
    vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([]);

    await AgentProfilePage({ params: { slug: "ryan-chong" } });

    expect(prisma.transactionFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agentId: "agent-1", status: "CLOSED", transactionSide: { not: "REFERRAL" } },
      })
    );
  });
});
