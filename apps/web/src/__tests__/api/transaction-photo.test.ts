import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    transactionFile: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/r2", () => ({ getPresignedGetUrl: vi.fn() }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPresignedGetUrl } from "@/lib/r2";
import { GET } from "../../app/api/transactions/[id]/photo/route";

function makeRequest() {
  return new Request("http://localhost/api/transactions/tf1/photo");
}

describe("GET /api/transactions/[id]/photo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: { id: "tf1" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the transaction has no photoKey", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ agentId: "a1", photoKey: null } as any);

    const res = await GET(makeRequest(), { params: { id: "tf1" } });
    expect(res.status).toBe(404);
  });

  it("returns 403 when the requester doesn't own the transaction file", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u2", role: "AGENT", agentId: "a2" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ agentId: "a1", photoKey: "key" } as any);

    const res = await GET(makeRequest(), { params: { id: "tf1" } });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the transaction file does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest(), { params: { id: "tf1" } });
    expect(res.status).toBe(404);
  });

  it("streams the photo when the requester owns the transaction file", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "AGENT", agentId: "a1" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ agentId: "a1", photoKey: "key" } as any);
    vi.mocked(getPresignedGetUrl).mockResolvedValue("https://r2.example.com/presigned-url");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("fake-image-bytes", { status: 200, headers: { "content-type": "image/png" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(makeRequest(), { params: { id: "tf1" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(getPresignedGetUrl).toHaveBeenCalledWith("key");

    vi.unstubAllGlobals();
  });

  it("ADMIN can access any agent's transaction photo", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u3", role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ agentId: "a1", photoKey: "key" } as any);
    vi.mocked(getPresignedGetUrl).mockResolvedValue("https://r2.example.com/presigned-url");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response("fake-image-bytes", { status: 200, headers: { "content-type": "image/png" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(makeRequest(), { params: { id: "tf1" } });
    expect(res.status).toBe(200);

    vi.unstubAllGlobals();
  });
});
