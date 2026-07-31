import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    announcement: { findUnique: vi.fn(), update: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/email", () => ({ sendAnnouncement: vi.fn() }));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendAnnouncement } from "@/lib/email";
import { POST } from "../../app/api/announcements/[id]/send/route";

function makeRequest() {
  return new Request("http://localhost/api/announcements/ann-1/send", { method: "POST" });
}

describe("POST /api/announcements/[id]/send", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-admins", async () => {
    const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    vi.mocked(requireAuth).mockResolvedValue({ session: null, error: forbidden } as any);

    const res = await POST(makeRequest(), { params: { id: "ann-1" } });

    expect(res.status).toBe(403);
    expect(prisma.announcement.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the announcement doesn't exist", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ session: {}, error: null } as any);
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue(null as any);

    const res = await POST(makeRequest(), { params: { id: "missing" } });

    expect(res.status).toBe(404);
  });

  it("emails every current agent and marks the announcement sent", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ session: {}, error: null } as any);
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue({
      id: "ann-1",
      title: "Office Closed",
      body: "Closed Monday.",
      sentAt: null,
    } as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { email: "agent1@example.com" },
      { email: "agent2@example.com" },
    ] as any);
    vi.mocked(sendAnnouncement).mockResolvedValue(undefined as any);
    vi.mocked(prisma.announcement.update).mockResolvedValue({} as any);

    const res = await POST(makeRequest(), { params: { id: "ann-1" } });

    expect(res.status).toBe(200);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: "AGENT" },
      select: { email: true },
    });

    expect(sendAnnouncement).toHaveBeenCalledWith(
      ["agent1@example.com", "agent2@example.com"],
      "Office Closed",
      "Closed Monday."
    );

    expect(prisma.announcement.update).toHaveBeenCalledOnce();
    const call = vi.mocked(prisma.announcement.update).mock.calls[0][0] as any;
    expect(call.where).toEqual({ id: "ann-1" });
    expect(call.data.sentAt).toBeInstanceOf(Date);
  });

  it("does not re-send an announcement that's already been sent", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ session: {}, error: null } as any);
    vi.mocked(prisma.announcement.findUnique).mockResolvedValue({
      id: "ann-1",
      title: "Office Closed",
      body: "Closed Monday.",
      sentAt: new Date("2026-01-01"),
    } as any);

    const res = await POST(makeRequest(), { params: { id: "ann-1" } });

    expect(res.status).toBe(400);
    expect(sendAnnouncement).not.toHaveBeenCalled();
    expect(prisma.announcement.update).not.toHaveBeenCalled();
  });
});
