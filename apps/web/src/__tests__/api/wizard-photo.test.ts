import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: { listingFile: { count: vi.fn().mockResolvedValue(0) }, transactionFile: { count: vi.fn().mockResolvedValue(0) } },
}));
vi.mock("@/lib/r2", () => ({
  getPresignedPutUrl: vi.fn().mockResolvedValue("https://r2.example/put"),
  getR2ObjectBuffer: vi.fn(),
  getR2ObjectSize: vi.fn().mockResolvedValue(1000),
  uploadToR2: vi.fn().mockResolvedValue(undefined),
  deleteR2Object: vi.fn().mockResolvedValue(undefined),
}));

import { getServerSession } from "next-auth";
import { getR2ObjectBuffer, getR2ObjectSize, getPresignedPutUrl, uploadToR2, deleteR2Object } from "@/lib/r2";
import { prisma } from "@/lib/prisma";

const png = (channels: 3 | 4 = 3) =>
  sharp({ create: { width: 20, height: 20, channels, background: channels === 4 ? { r: 0, g: 0, b: 0, alpha: 0 } : "#ffffff" } }).png().toBuffer();
import { GET as uploadUrl } from "../../app/api/wizard-photo/upload-url/route";
import { POST as processPhoto } from "../../app/api/wizard-photo/route";

const AGENT = { user: { id: "u1", role: "AGENT", agentId: "a1" } };
const ask = (q: Record<string, string>) =>
  uploadUrl(new Request(`http://localhost/api/wizard-photo/upload-url?${new URLSearchParams(q)}`));
const post = (body: unknown) =>
  processPhoto(new Request("http://localhost/api/wizard-photo", { method: "POST", body: JSON.stringify(body) }));

describe("GET /api/wizard-photo/upload-url", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not signed in", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    expect((await ask({ filename: "a.jpg", contentType: "image/jpeg", size: "10" })).status).toBe(401);
  });

  it("refuses a HEIC photo with a readable reason", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    const res = await ask({ filename: "a.heic", contentType: "image/heic", size: "10" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Photo must be a JPG or PNG");
  });

  it("refuses a photo over 20MB", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    const res = await ask({ filename: "a.jpg", contentType: "image/jpeg", size: String(25 * 1024 * 1024) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Photo exceeds 20MB limit");
  });

  it("gives an upload URL under the caller's own prefix", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    const res = await ask({ filename: "a.jpg", contentType: "image/jpeg", size: "10" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.uploadUrl).toBe("https://r2.example/put");
    expect(body.key).toMatch(/^wizard-photos\/u1\/[a-z0-9]+\/original$/);
  });

  it("signs the stated size so storage refuses a bigger upload", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    await ask({ filename: "a.jpg", contentType: "image/jpeg", size: "12345" });
    expect(getPresignedPutUrl).toHaveBeenCalledWith(expect.stringMatching(/\/original$/), "image/jpeg", 12345);
  });

  it("refuses a missing size", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    expect((await ask({ filename: "a.jpg", contentType: "image/jpeg" })).status).toBe(400);
  });
});

describe("POST /api/wizard-photo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shrinks the photo and returns its key", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#9E8C61" } }).png().toBuffer();
    vi.mocked(getR2ObjectBuffer).mockResolvedValue(big);

    const res = await post({ key: "wizard-photos/u1/abc/original" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ photoKey: "wizard-photos/u1/abc/photo.jpg" });
    const [key, buf, type] = vi.mocked(uploadToR2).mock.calls[0];
    expect(key).toBe("wizard-photos/u1/abc/photo.jpg");
    expect(type).toBe("image/jpeg");
    const meta = await sharp(buf as Buffer).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width!, meta.height!)).toBe(1600);
    expect(deleteR2Object).toHaveBeenCalledWith("wizard-photos/u1/abc/original");
  });

  it("refuses another user's key", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    const res = await post({ key: "wizard-photos/u2/abc/original" });
    expect(res.status).toBe(403);
    expect(getR2ObjectBuffer).not.toHaveBeenCalled();
  });

  it("says so when the file isn't a readable image", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(getR2ObjectBuffer).mockResolvedValue(Buffer.from("not an image"));
    const res = await post({ key: "wizard-photos/u1/abc/original" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Couldn't read that photo");
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it("checks the real stored size before reading, and deletes an oversized upload", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(getR2ObjectSize).mockResolvedValueOnce(25 * 1024 * 1024);
    const res = await post({ key: "wizard-photos/u1/abc/original" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Photo exceeds 20MB limit");
    expect(getR2ObjectBuffer).not.toHaveBeenCalled();
    expect(deleteR2Object).toHaveBeenCalledWith("wizard-photos/u1/abc/original");
  });

  it("deletes the raw upload when the photo can't be read", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(getR2ObjectBuffer).mockResolvedValue(Buffer.from("not an image"));
    await post({ key: "wizard-photos/u1/abc/original" });
    expect(deleteR2Object).toHaveBeenCalledWith("wizard-photos/u1/abc/original");
  });

  it("still reports success when only the cleanup of the original fails", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(getR2ObjectBuffer).mockResolvedValue(await png());
    vi.mocked(deleteR2Object).mockRejectedValueOnce(new Error("R2 down"));
    const res = await post({ key: "wizard-photos/u1/abc/original" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ photoKey: "wizard-photos/u1/abc/photo.jpg" });
  });

  it("gives a transparent PNG a white background, not black", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(getR2ObjectBuffer).mockResolvedValue(await png(4));
    await post({ key: "wizard-photos/u1/abc/original" });
    const { data } = await sharp(vi.mocked(uploadToR2).mock.calls[0][1] as Buffer).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(240);
  });

  it("deletes the photo being replaced when it is the caller's and no file uses it", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(getR2ObjectBuffer).mockResolvedValue(await png());
    await post({ key: "wizard-photos/u1/new/original", replaces: "wizard-photos/u1/old/photo.jpg" });
    expect(deleteR2Object).toHaveBeenCalledWith("wizard-photos/u1/old/photo.jpg");
  });

  it("keeps a replaced photo that a file already uses, or that isn't the caller's", async () => {
    vi.mocked(getServerSession).mockResolvedValue(AGENT as any);
    vi.mocked(getR2ObjectBuffer).mockResolvedValue(await png());
    vi.mocked(prisma.listingFile.count).mockResolvedValueOnce(1);
    await post({ key: "wizard-photos/u1/new/original", replaces: "wizard-photos/u1/old/photo.jpg" });
    await post({ key: "wizard-photos/u1/new2/original", replaces: "wizard-photos/u2/theirs/photo.jpg" });
    const deleted = vi.mocked(deleteR2Object).mock.calls.map((c) => c[0]);
    expect(deleted).not.toContain("wizard-photos/u1/old/photo.jpg");
    expect(deleted).not.toContain("wizard-photos/u2/theirs/photo.jpg");
  });
});
