import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { update: vi.fn() },
    user: { update: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { makeUnsubscribeToken } from "@/lib/email/unsubscribe";
import { POST } from "../../app/api/unsubscribe/route";

function req(token: string) {
  return new Request("http://localhost/api/unsubscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

describe("POST /api/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "test-secret";
  });

  it("sets emailOptOut on a lead", async () => {
    const res = await POST(req(makeUnsubscribeToken("lead", "lead_1")));
    expect(res.status).toBe(200);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead_1" },
      data: { emailOptOut: true },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("sets emailOptOut on a user", async () => {
    const res = await POST(req(makeUnsubscribeToken("user", "user_1")));
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { emailOptOut: true },
    });
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid token without touching the database", async () => {
    const res = await POST(req("garbage"));
    expect(res.status).toBe(400);
    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a token signed with a different secret", async () => {
    const forged = makeUnsubscribeToken("lead", "lead_1");
    process.env.NEXTAUTH_SECRET = "a-different-secret";

    const res = await POST(req(forged));
    expect(res.status).toBe(400);
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("rejects a malformed body without throwing", async () => {
    const res = await POST(
      new Request("http://localhost/api/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      })
    );
    expect(res.status).toBe(400);
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("honours an RFC 8058 one-click POST with the token in the query string", async () => {
    // What Gmail actually sends: form-encoded body, token in the URL. Parsing
    // this body as JSON would throw, so the query string has to win.
    const token = makeUnsubscribeToken("lead", "lead_1");
    const res = await POST(
      new Request(`http://localhost/api/unsubscribe?t=${token}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      })
    );

    expect(res.status).toBe(200);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead_1" },
      data: { emailOptOut: true },
    });
  });

  it("rejects a one-click POST carrying a forged query token", async () => {
    const res = await POST(
      new Request("http://localhost/api/unsubscribe?t=garbage", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      })
    );

    expect(res.status).toBe(400);
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });

  it("stays 200 for an already-unsubscribed recipient", async () => {
    await POST(req(makeUnsubscribeToken("lead", "lead_1")));
    const res = await POST(req(makeUnsubscribeToken("lead", "lead_1")));
    expect(res.status).toBe(200);
  });
});
