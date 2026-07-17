import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    campaignContact: { upsert: vi.fn() },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST as createCampaign } from "../../app/api/campaigns/route";
import { PATCH as patchCampaign } from "../../app/api/campaigns/[id]/route";
import { POST as addContacts } from "../../app/api/campaigns/[id]/contacts/route";

function makeRequest(url: string, body: object, method = "POST") {
  return new Request(url, {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const AGENT_SESSION = {
  session: { user: { id: "agent-1", email: "agent@cnc.com", role: "AGENT", agentId: "a1" } },
  error: null,
} as any;

describe("POST /api/campaigns — Zod validation error message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(AGENT_SESSION);
  });

  it("returns the specific validation message for an invalid submission, not a crash", async () => {
    const res = await createCampaign(makeRequest("http://localhost/api/campaigns", { name: "", type: "EMAIL" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Name required");
    expect(prisma.campaign.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/campaigns/[id] — Zod validation error message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(AGENT_SESSION);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1" } as any);
  });

  it("returns the specific validation message for an invalid submission, not a crash", async () => {
    const res = await patchCampaign(
      makeRequest("http://localhost/api/campaigns/c1", { scheduledAt: "not-a-date" }, "PATCH"),
      { params: { id: "c1" } }
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid ISO datetime");
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/campaigns/[id]/contacts — Zod validation error message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(AGENT_SESSION);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: "c1", agentId: "a1" } as any);
  });

  it("returns the specific validation message for an invalid submission, not a crash", async () => {
    const res = await addContacts(
      makeRequest("http://localhost/api/campaigns/c1/contacts", { leadIds: [] }),
      { params: { id: "c1" } }
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("At least one lead required");
    expect(prisma.campaignContact.upsert).not.toHaveBeenCalled();
  });
});
