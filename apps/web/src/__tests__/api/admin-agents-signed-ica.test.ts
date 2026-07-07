import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { agent: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/r2", () => ({
  getPresignedGetUrl: vi.fn(),
}));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getPresignedGetUrl } from "@/lib/r2";
import { GET } from "../../app/api/admin/agents/[id]/signed-ica/route";

describe("GET /api/admin/agents/[id]/signed-ica", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the agent has no signed ICA on file", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ error: undefined } as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ signedIcaKey: null } as any);

    const req = new Request("http://localhost/api/admin/agents/agent-1/signed-ica");
    const res = await GET(req, { params: { id: "agent-1" } });

    expect(res.status).toBe(404);
  });

  it("returns a presigned url when the agent has a signed ICA on file", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ error: undefined } as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ signedIcaKey: "signed-ica/app-1.pdf" } as any);
    vi.mocked(getPresignedGetUrl).mockResolvedValue("https://r2.example.com/signed-url");

    const req = new Request("http://localhost/api/admin/agents/agent-1/signed-ica");
    const res = await GET(req, { params: { id: "agent-1" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://r2.example.com/signed-url");
    expect(getPresignedGetUrl).toHaveBeenCalledWith("signed-ica/app-1.pdf");
  });
});
