process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    listingFile: { findUnique: vi.fn() },
    transactionFile: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/r2", () => ({
  getPresignedPutUrl: vi.fn().mockResolvedValue("https://r2.example/put-url"),
  buildR2Key: vi.fn().mockReturnValue("some/r2/key"),
}));
vi.mock("@paralleldrive/cuid2", () => ({ createId: () => "generated-id" }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPresignedPutUrl } from "@/lib/r2";
import { GET } from "../../app/api/upload-url/route";

const SESSION_AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };

function req(fileType: string, fileId: string) {
  return new Request(
    `http://localhost/api/upload-url?fileType=${fileType}&fileId=${fileId}&filename=doc.pdf&contentType=application/pdf&size=1000`
  );
}

describe("GET /api/upload-url", () => {
  beforeEach(() => vi.clearAllMocks());

  it("currently lets a non-owning agent get a presigned upload URL for another agent's file", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2" } as any);

    const res = await GET(req("listing", "f1"));
    expect(res.status).toBe(403);
    expect(getPresignedPutUrl).not.toHaveBeenCalled();
  });

  it("allows the owning agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1" } as any);

    const res = await GET(req("listing", "f1"));
    expect(res.status).toBe(200);
    expect(getPresignedPutUrl).toHaveBeenCalledOnce();
  });

  it("rejects an unrecognized fileType with 400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(SESSION_AGENT as any);

    const res = await GET(req("bogus", "f1"));
    expect(res.status).toBe(400);
  });
});
