import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() } },
}));
vi.mock("@/lib/rate-limit", () => ({
  publicFormRateLimit: { limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }) },
}));
vi.mock("@/lib/email", () => ({ sendLeadNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/newsletter", () => ({ subscribeToNewsletter: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { subscribeToNewsletter } from "@/lib/newsletter";
import { GET, POST } from "../../app/api/leads/route";

function makeRequest(body: object) {
  return new Request("http://localhost/api/leads", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/leads — Zod validation error message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ session: null, error: null as any });
  });

  it("returns the specific validation message for an invalid submission, not a crash", async () => {
    const res = await POST(makeRequest({ firstName: "", lastName: "Doe", email: "jane@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("First name required");
  });
});

describe("POST /api/leads — utmSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ session: null, error: null as any });
  });

  it("accepts an optional utmSource and stores it on the lead", async () => {
    vi.mocked(prisma.lead.create).mockResolvedValue({ id: "lead1" } as any);

    const res = await POST(new Request("http://localhost/api/leads", {
      method: "POST",
      body: JSON.stringify({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        role: "Owner",
        notes: "Hi",
        source: "WEBSITE",
        utmSource: "MANAGE_TENANT_PLACEMENT",
      }),
    }));

    expect(res.status).toBe(201);
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ utmSource: "MANAGE_TENANT_PLACEMENT" }),
    });
  });
});

describe("POST /api/leads — visitor role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ session: null, error: null as any });
  });

  it("persists the visitor-selected role", async () => {
    vi.mocked(prisma.lead.create).mockResolvedValue({ id: "lead1" } as any);

    const res = await POST(new Request("http://localhost/api/leads", {
      method: "POST",
      body: JSON.stringify({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        role: "Owner",
        notes: "Hi",
        source: "WEBSITE",
      }),
    }));

    expect(res.status).toBe(201);
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ visitorRole: "Owner" }),
    });
  });
});

describe("GET /api/leads — personal scope", () => {
  const as = (role: string, agentId: string | null) =>
    vi.mocked(requireAuth).mockResolvedValue({ session: { user: { id: "u", role, agentId } }, error: null } as any);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.lead.findMany).mockResolvedValue([]);
    vi.mocked(prisma.lead.count).mockResolvedValue(0);
  });

  it("gives an ADMIN's lead pickers only their own leads", async () => {
    as("ADMIN", "agent-2");
    await GET(new Request("http://localhost/api/leads"));
    expect(prisma.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { agentId: "agent-2" } }));
  });

  it("scopes an ADMIN's smart-list results to their own leads", async () => {
    as("ADMIN", "agent-2");
    const filters = encodeURIComponent(JSON.stringify([{ field: "status", operator: "is", value: ["NEW"] }]));
    await GET(new Request(`http://localhost/api/leads?filters=${filters}`));
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ agentId: "agent-2" }, { status: { in: ["NEW"] } }] } })
    );
  });

  it("returns nothing, never the whole brokerage, for an ADMIN with no agentId", async () => {
    as("ADMIN", null);
    const res = await GET(new Request("http://localhost/api/leads"));
    expect(await res.json()).toEqual([]);
    expect(prisma.lead.findMany).not.toHaveBeenCalled();
  });

  const newsletter = encodeURIComponent(JSON.stringify([{ field: "newsletter", operator: "is", value: true }]));

  it("shows an ADMIN every newsletter subscriber in the brokerage", async () => {
    as("ADMIN", "agent-2");
    await GET(new Request(`http://localhost/api/leads?filters=${newsletter}`));
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{ newsletterSubscribedAt: { not: null }, newsletterOptOut: false }] } })
    );
  });

  it("refuses the newsletter list to an AGENT", async () => {
    as("AGENT", "agent-1");
    const res = await GET(new Request(`http://localhost/api/leads?filters=${newsletter}`));
    expect(res.status).toBe(403);
    expect(prisma.lead.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/leads — newsletter consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ session: null, error: null as any });
    vi.mocked(prisma.lead.create).mockResolvedValue({ id: "lead-9", email: "jane@example.com" } as any);
  });

  const submit = (extra: object) =>
    POST(makeRequest({ firstName: "Jane", lastName: "Doe", email: "jane@example.com", role: "Buyer", ...extra }));

  it("enrolls the new lead when the form shows the consent disclaimer", async () => {
    const res = await submit({ newsletterConsent: true });
    expect(res.status).toBe(201);
    expect(subscribeToNewsletter).toHaveBeenCalledWith({ email: "jane@example.com", leadId: "lead-9", source: "contact-form" });
    expect(prisma.lead.create).toHaveBeenCalledWith({ data: expect.not.objectContaining({ newsletterConsent: true }) });
  });

  it("does not enroll forms without the disclaimer (Let's Start, tour requests, Add Lead)", async () => {
    await submit({});
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });

  it("still accepts the inquiry when enrollment fails", async () => {
    vi.mocked(subscribeToNewsletter).mockRejectedValueOnce(new Error("db down"));
    const res = await submit({ newsletterConsent: true });
    expect(res.status).toBe(201);
  });

  it("accepts newsletterConsent: false without a 400 and does not enroll", async () => {
    const res = await submit({ newsletterConsent: false });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("lead-9");
    expect(prisma.lead.create).toHaveBeenCalledWith({ data: expect.not.objectContaining({ newsletterConsent: expect.anything() }) });
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });
});
