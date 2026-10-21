import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/r2", () => ({ listR2Objects: vi.fn(), deleteR2Object: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { listingFile: { findMany: vi.fn() }, transactionFile: { findMany: vi.fn() } },
}));

import { GET } from "@/app/api/cron/wizard-photo-cleanup/route";
import { listR2Objects, deleteR2Object } from "@/lib/r2";
import { prisma } from "@/lib/prisma";

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const req = (secret?: string) =>
  new NextRequest("http://localhost/api/cron/wizard-photo-cleanup", { headers: secret ? { authorization: `Bearer ${secret}` } : {} });

describe("/api/cron/wizard-photo-cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "s");
    vi.mocked(prisma.listingFile.findMany).mockResolvedValue([{ photoKey: "wizard-photos/u1/used/photo.jpg" }] as any);
    vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([{ photoKey: "wizard-photos/u2/used-tx/photo.jpg" }] as any);
  });

  it("returns 401 with the wrong secret and deletes nothing", async () => {
    expect((await GET(req("wrong"))).status).toBe(401);
    expect(listR2Objects).not.toHaveBeenCalled();
  });

  it("deletes wizard photos over 2 days old that no file uses, and keeps the rest", async () => {
    vi.mocked(listR2Objects).mockResolvedValue([
      { key: "wizard-photos/u1/used/photo.jpg", lastModified: ago(30) },
      { key: "wizard-photos/u2/used-tx/photo.jpg", lastModified: ago(30) },
      { key: "wizard-photos/u1/abandoned/photo.jpg", lastModified: ago(3) },
      { key: "wizard-photos/u1/stuck/original", lastModified: ago(3) },
      { key: "wizard-photos/u1/fresh/photo.jpg", lastModified: ago(1) },
    ]);
    const res = await GET(req("s"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 2 });
    const deleted = vi.mocked(deleteR2Object).mock.calls.map((c) => c[0]).sort();
    expect(deleted).toEqual(["wizard-photos/u1/abandoned/photo.jpg", "wizard-photos/u1/stuck/original"]);
    expect(listR2Objects).toHaveBeenCalledWith("wizard-photos/");
  });
});
