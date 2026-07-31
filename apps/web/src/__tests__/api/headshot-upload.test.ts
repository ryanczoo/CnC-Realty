import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

vi.mock("@/lib/api-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-auth")>()),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/r2", () => ({
  uploadToR2: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { updateMany: vi.fn() },
  },
}));

import { requireAuth } from "@/lib/api-auth";
import { uploadToR2 } from "@/lib/r2";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/account/headshot-upload/route";

const SESSION = {
  session: { user: { id: "u1", email: "a@cnc.com", role: "AGENT", agentId: "a1" } },
  error: null,
} as any;

async function makeOversizedJpeg(): Promise<Buffer> {
  // A large, uncompressed-looking photo — noise avoids JPEG's own compression
  // collapsing a flat color down to a tiny file, which would defeat the test.
  const width = 2000;
  const height = 2000;
  const noise = Buffer.alloc(width * height * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = Math.floor(Math.random() * 256);
  return sharp(noise, { raw: { width, height, channels: 3 } }).jpeg({ quality: 70 }).toBuffer();
}

function requestWithFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return new Request("http://localhost/api/account/headshot-upload", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/account/headshot-upload — resizing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(SESSION);
    vi.mocked(uploadToR2).mockResolvedValue(undefined);
    vi.mocked(prisma.agent.updateMany).mockResolvedValue({ count: 1 } as any);
  });

  it("resizes an oversized upload down to a max of 512px per side before storing", async () => {
    const originalBuffer = await makeOversizedJpeg();
    const file = new File([originalBuffer as unknown as BlobPart], "photo.jpg", { type: "image/jpeg" });

    const res = await POST(requestWithFile(file));
    expect(res.status).toBe(200);

    expect(uploadToR2).toHaveBeenCalledTimes(1);
    const [, storedBuffer] = vi.mocked(uploadToR2).mock.calls[0];
    const metadata = await sharp(storedBuffer as Buffer).metadata();

    expect(metadata.width).toBeLessThanOrEqual(512);
    expect(metadata.height).toBeLessThanOrEqual(512);
    expect((storedBuffer as Buffer).length).toBeLessThan(originalBuffer.length);
  });

  it("leaves a small, already-within-bounds image essentially as-is in dimensions", async () => {
    const small = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r: 100, g: 120, b: 140 } },
    }).jpeg().toBuffer();
    const file = new File([small], "small.jpg", { type: "image/jpeg" });

    const res = await POST(requestWithFile(file));
    expect(res.status).toBe(200);

    const [, storedBuffer] = vi.mocked(uploadToR2).mock.calls[0];
    const metadata = await sharp(storedBuffer as Buffer).metadata();
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(200);
  });
});
