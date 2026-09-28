import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/lib/rate-limit", () => ({
  publicFormRateLimit: { limit: vi.fn() },
}));
vi.mock("@/lib/email/newsletter-email", () => ({ sendNewsletterWelcome: vi.fn().mockResolvedValue({ sent: true }) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { publicFormRateLimit } from "@/lib/rate-limit";
import { sendNewsletterWelcome } from "@/lib/email/newsletter-email";
import { emailMatchWhere } from "@/lib/email-match";
import { POST } from "../../app/api/newsletter/subscribe/route";

const subscribe = (email: string) =>
  POST(new Request("http://localhost/api/newsletter/subscribe", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
  }));

describe("POST /api/newsletter/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(publicFormRateLimit.limit).mockResolvedValue({ success: true, reset: Date.now() + 60000 } as any);
    vi.mocked(prisma.lead.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.lead.create).mockResolvedValue({ id: "new-lead" } as any);
  });

  it("refuses an invalid email without saving anything", async () => {
    const res = await subscribe("not an email");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Please enter a valid email address.");
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("adds a new visitor as a brokerage lead on the newsletter and welcomes them", async () => {
    const res = await subscribe("  sam@example.com ");
    expect(await res.json()).toEqual({ ok: true });
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: {
        firstName: "Newsletter", lastName: "Subscriber", email: "sam@example.com",
        source: "NEWSLETTER", agentId: null, newsletterSubscribedAt: expect.any(Date),
      },
    });
    expect(sendNewsletterWelcome).toHaveBeenCalledWith({ to: "sam@example.com", leadId: "new-lead" });
  });

  it("looks the email up ignoring capitalization, with wildcards escaped", async () => {
    await subscribe("Sam@Example.com");
    expect(prisma.lead.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: emailMatchWhere("Sam@Example.com") }));
  });

  it("subscribes an existing lead in place (no duplicate, agent unchanged) and welcomes them once", async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: "lead-1", email: "Sam@Example.com", newsletterSubscribedAt: null } as any);
    await subscribe("sam@example.com");
    expect(prisma.lead.create).not.toHaveBeenCalled();
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: { newsletterSubscribedAt: expect.any(Date), newsletterOptOut: false },
    });
    expect(sendNewsletterWelcome).toHaveBeenCalledWith({ to: "Sam@Example.com", leadId: "lead-1" });
  });

  it("re-subscribes someone who left, keeping their original join date and skipping the welcome", async () => {
    const joined = new Date("2026-01-01");
    vi.mocked(prisma.lead.findFirst).mockResolvedValue({ id: "lead-1", email: "sam@example.com", newsletterSubscribedAt: joined } as any);
    const res = await subscribe("sam@example.com");
    expect(await res.json()).toEqual({ ok: true });
    expect(prisma.lead.update).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { newsletterOptOut: false } });
    expect(sendNewsletterWelcome).not.toHaveBeenCalled();
  });

  it("still reports success if the welcome email fails to send", async () => {
    vi.mocked(sendNewsletterWelcome).mockRejectedValueOnce(new Error("postmark down"));
    const res = await subscribe("sam@example.com");
    expect(res.status).toBe(200);
  });

  it("is rate limited like the other public forms", async () => {
    vi.mocked(publicFormRateLimit.limit).mockResolvedValue({ success: false, reset: Date.now() + 60000 } as any);
    const res = await subscribe("sam@example.com");
    expect(res.status).toBe(429);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });
});
