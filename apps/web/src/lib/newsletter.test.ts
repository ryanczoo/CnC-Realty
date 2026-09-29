import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { lead: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/lib/email/newsletter-email", () => ({ sendNewsletterWelcome: vi.fn().mockResolvedValue({ sent: true }) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { sendNewsletterWelcome } from "@/lib/email/newsletter-email";
import { emailMatchWhere } from "@/lib/email-match";
import { subscribeToNewsletter } from "./newsletter";

const lead = (over: Partial<{ id: string; email: string; newsletterSubscribedAt: Date | null; newsletterOptOut: boolean }>) => ({
  id: "lead-1", email: "sam@example.com", newsletterSubscribedAt: null, newsletterOptOut: false, ...over,
});

describe("subscribeToNewsletter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.lead.findMany).mockResolvedValue([]);
    vi.mocked(prisma.lead.create).mockResolvedValue({ id: "new-lead" } as any);
  });

  it("looks the address up ignoring capitalization, oldest lead first", async () => {
    await subscribeToNewsletter({ email: "Sam@Example.com", source: "footer" });
    expect(prisma.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: emailMatchWhere("Sam@Example.com"), orderBy: { createdAt: "asc" },
    }));
  });

  it("footer: a brand-new address becomes a brokerage Newsletter Subscriber lead and is welcomed", async () => {
    await subscribeToNewsletter({ email: "sam@example.com", source: "footer" });
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: {
        firstName: "Newsletter", lastName: "Subscriber", email: "sam@example.com",
        source: "NEWSLETTER", agentId: null, newsletterSubscribedAt: expect.any(Date),
      },
    });
    expect(sendNewsletterWelcome).toHaveBeenCalledWith({ to: "sam@example.com", leadId: "new-lead" });
  });

  it("footer: subscribes an existing lead in place and welcomes them at their stored address", async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([lead({ email: "Sam@Example.com" })] as any);
    await subscribeToNewsletter({ email: "sam@example.com", source: "footer" });
    expect(prisma.lead.create).not.toHaveBeenCalled();
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead-1" }, data: { newsletterSubscribedAt: expect.any(Date), newsletterOptOut: false },
    });
    expect(sendNewsletterWelcome).toHaveBeenCalledWith({ to: "Sam@Example.com", leadId: "lead-1" });
  });

  it("does nothing when the address is already subscribed on any lead (no duplicate, no second welcome)", async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([
      lead({ id: "old", newsletterSubscribedAt: new Date("2026-01-01") }),
      lead({ id: "new-contact" }),
    ] as any);
    await subscribeToNewsletter({ email: "SAM@example.com", source: "contact-form", leadId: "new-contact" });
    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.lead.create).not.toHaveBeenCalled();
    expect(sendNewsletterWelcome).not.toHaveBeenCalled();
  });

  it("footer: re-subscribes someone who left, keeping their join date, without a welcome", async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([
      lead({ newsletterSubscribedAt: new Date("2026-01-01"), newsletterOptOut: true }),
    ] as any);
    await subscribeToNewsletter({ email: "sam@example.com", source: "footer" });
    expect(prisma.lead.update).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { newsletterOptOut: false } });
    expect(sendNewsletterWelcome).not.toHaveBeenCalled();
  });

  it("contact form: never re-subscribes someone who unsubscribed", async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([
      lead({ id: "old", newsletterSubscribedAt: new Date("2026-01-01"), newsletterOptOut: true }),
      lead({ id: "new-contact" }),
    ] as any);
    await subscribeToNewsletter({ email: "sam@example.com", source: "contact-form", leadId: "new-contact" });
    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(sendNewsletterWelcome).not.toHaveBeenCalled();
  });

  it("contact form: subscribes the lead the form just created (an agent's lead stays the agent's)", async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([lead({ id: "older" }), lead({ id: "agents-lead" })] as any);
    await subscribeToNewsletter({ email: "sam@example.com", source: "contact-form", leadId: "agents-lead" });
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "agents-lead" }, data: { newsletterSubscribedAt: expect.any(Date), newsletterOptOut: false },
    });
    expect(sendNewsletterWelcome).toHaveBeenCalledWith({ to: "sam@example.com", leadId: "agents-lead" });
  });

  it("contact form: never creates a brokerage subscriber lead of its own", async () => {
    await subscribeToNewsletter({ email: "sam@example.com", source: "contact-form", leadId: "missing" });
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it("does not throw when the welcome email fails", async () => {
    vi.mocked(sendNewsletterWelcome).mockRejectedValueOnce(new Error("postmark down"));
    await expect(subscribeToNewsletter({ email: "sam@example.com", source: "footer" })).resolves.toBeUndefined();
  });
});
