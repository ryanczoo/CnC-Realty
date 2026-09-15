import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));

import { requireAuth } from "@/lib/api-auth";
import { GET } from "../../app/api/transfer-forms/[type]/route";

describe("GET /api/transfer-forms/[type]", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as any);
    const res = await GET(new Request("http://localhost/api/transfer-forms/listing"), { params: { type: "listing" } });
    expect(res.status).toBe(401);
  });

  it("streams the listing form PDF when signed in", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ session: { user: { id: "agent-1" } }, error: null } as any);
    const res = await GET(new Request("http://localhost/api/transfer-forms/listing"), { params: { type: "listing" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("streams the pending-sale form PDF when signed in", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ session: { user: { id: "agent-1" } }, error: null } as any);
    const res = await GET(new Request("http://localhost/api/transfer-forms/pending-sale"), { params: { type: "pending-sale" } });
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("returns 404 for an unknown type", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ session: { user: { id: "agent-1" } }, error: null } as any);
    const res = await GET(new Request("http://localhost/api/transfer-forms/bogus"), { params: { type: "bogus" } });
    expect(res.status).toBe(404);
  });
});
