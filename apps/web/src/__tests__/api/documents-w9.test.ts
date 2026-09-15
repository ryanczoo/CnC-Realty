import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));

import { requireAuth } from "@/lib/api-auth";
import { GET } from "../../app/api/documents/w9/route";

describe("GET /api/documents/w9", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as any);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("streams the W-9 PDF inline when signed in", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ session: { user: { id: "agent-1" } }, error: null } as any);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("inline");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
