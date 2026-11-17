import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email", () => ({ sendLeadNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/newsletter", () => ({ subscribeToNewsletter: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import { sendLeadNotification } from "@/lib/email";
import { subscribeToNewsletter } from "@/lib/newsletter";
import { leadCreateData, afterLeadCreated } from "@/lib/leads/create-lead";

const lead = { id: "l1", email: "jane@example.com" } as any;

beforeEach(() => vi.clearAllMocks());

describe("leadCreateData", () => {
  it("maps role to visitorRole and never sets agentId", () => {
    const data = leadCreateData({
      firstName: "Jane", lastName: "Doe", email: "jane@example.com", source: "WEBSITE", role: "Home Buyer",
    });
    expect(data).toMatchObject({ firstName: "Jane", source: "WEBSITE", visitorRole: "Home Buyer" });
    expect(data).not.toHaveProperty("role");
    expect(data).not.toHaveProperty("agentId");
  });
});

describe("afterLeadCreated", () => {
  it("notifies and subscribes once with consent", async () => {
    await afterLeadCreated(lead, { newsletterConsent: true });
    expect(sendLeadNotification).toHaveBeenCalledWith(lead);
    expect(subscribeToNewsletter).toHaveBeenCalledTimes(1);
    expect(subscribeToNewsletter).toHaveBeenCalledWith({ email: "jane@example.com", leadId: "l1", source: "contact-form" });
  });
  it("does not subscribe without consent", async () => {
    await afterLeadCreated(lead, {});
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });
  it("swallows newsletter failures and reports to Sentry", async () => {
    vi.mocked(subscribeToNewsletter).mockRejectedValueOnce(new Error("db down"));
    await expect(afterLeadCreated(lead, { newsletterConsent: true })).resolves.toBeUndefined();
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});
