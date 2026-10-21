import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: { listingFile: { findUnique: vi.fn() }, transactionFile: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/r2", () => ({ getR2ObjectBuffer: vi.fn().mockResolvedValue(Buffer.from("jpeg-bytes")) }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getR2ObjectBuffer } from "@/lib/r2";
import { GET } from "../../app/api/files/[fileType]/[id]/photo/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const get = (fileType: string, id = "f1") => GET(new Request("http://localhost"), { params: { fileType, id } });

describe("GET /api/files/[fileType]/[id]/photo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not signed in", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect((await get("listing")).status).toBe(401);
  });

  it("returns 400 for an unknown file type", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    expect((await get("referral")).status).toBe(400);
  });

  it("serves a listing photo to its agent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ agentId: "a1", photoKey: "wizard-photos/u1/x/photo.jpg" } as any);
    const res = await get("listing");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("jpeg-bytes");
    expect(getR2ObjectBuffer).toHaveBeenCalledWith("wizard-photos/u1/x/photo.jpg");
  });

  it("serves any file's photo to the broker", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u9", role: "ADMIN", agentId: null } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ agentId: "a1", photoKey: "k/photo.jpg" } as any);
    expect((await get("transaction")).status).toBe(200);
  });

  it("hides another agent's photo", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u2", role: "AGENT", agentId: "a2" } } as any);
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({ agentId: "a1", photoKey: "k/photo.jpg" } as any);
    expect((await get("transaction")).status).toBe(404);
    expect(getR2ObjectBuffer).not.toHaveBeenCalled();
  });

  it("returns 404 when the file has no photo or doesn't exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValueOnce({ agentId: "a1", photoKey: null } as any).mockResolvedValueOnce(null);
    expect((await get("listing")).status).toBe(404);
    expect((await get("listing")).status).toBe(404);
  });

  it("is cacheable for an hour", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue({ agentId: "a1", photoKey: "k/photo.jpg" } as any);
    expect((await get("listing")).headers.get("Cache-Control")).toBe("private, max-age=3600");
  });
});
