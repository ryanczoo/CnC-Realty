import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/r2", () => ({
  getPresignedPutUrl: vi.fn().mockResolvedValue("https://r2.example/put"),
  getR2ObjectBuffer: vi.fn(),
  uploadToR2: vi.fn().mockResolvedValue(undefined),
  deleteR2Object: vi.fn().mockResolvedValue(undefined),
}));

import { getServerSession } from "next-auth";
import { getR2ObjectBuffer, uploadToR2, deleteR2Object } from "@/lib/r2";
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
});
