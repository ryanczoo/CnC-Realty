import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { announcement: { create: vi.fn() } },
}));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/announcements/route";

function makeRequest(body: object) {
  return new Request("http://localhost/api/announcements", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/announcements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-admins", async () => {
    const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    vi.mocked(requireAuth).mockResolvedValue({ session: null, error: forbidden } as any);

    const res = await POST(makeRequest({ title: "Test", body: "Body" }));

    expect(res.status).toBe(403);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it("creates a draft announcement (sentAt null) for admins", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ session: {}, error: null } as any);
    vi.mocked(prisma.announcement.create).mockResolvedValue({
      id: "ann-1",
      title: "Office Closed",
      body: "Closed Monday.",
      sentAt: null,
    } as any);

    const res = await POST(makeRequest({ title: "Office Closed", body: "Closed Monday." }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("ann-1");
    expect(prisma.announcement.create).toHaveBeenCalledWith({
      data: { title: "Office Closed", body: "Closed Monday." },
    });
  });

  it("rejects an empty title", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ session: {}, error: null } as any);

    const res = await POST(makeRequest({ title: "", body: "Closed Monday." }));

    expect(res.status).toBe(400);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });
});
