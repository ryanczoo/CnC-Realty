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
import { AGENT_VIEW_HEADER } from "@/lib/agent-view";

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

describe("GET /api/upload-url — agent-view marker", () => {
  const VIEWING_ADMIN = { user: { id: "admin1", role: "ADMIN", agentId: "a1" } };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(VIEWING_ADMIN as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a2", status: "ACTIVE" } as any);
  });

  it("refuses another agent's file with the marker, allows it without", async () => {
    const url = "http://localhost/api/upload-url?fileType=listing&fileId=f1&filename=doc.pdf&contentType=application/pdf&size=1000";
    expect((await GET(new Request(url, { headers: { [AGENT_VIEW_HEADER]: "1" } }))).status).toBe(403);
    expect(getPresignedPutUrl).not.toHaveBeenCalled();
    expect((await GET(req("listing", "f1"))).status).toBe(200);
  });

  it("locks a closed file for the admin with the marker, open without", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ id: "f1", agentId: "a1", status: "CLOSED" } as any);
    const url = "http://localhost/api/upload-url?fileType=listing&fileId=f1&filename=doc.pdf&contentType=application/pdf&size=1000";
    expect((await GET(new Request(url, { headers: { [AGENT_VIEW_HEADER]: "1" } }))).status).toBe(403);
    expect((await GET(req("listing", "f1"))).status).toBe(200);
  });
});
