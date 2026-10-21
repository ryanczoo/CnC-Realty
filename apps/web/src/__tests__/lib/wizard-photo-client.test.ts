import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadWizardPhoto } from "@/lib/wizard-photo-client";

const photo = new File(["x"], "house.jpg", { type: "image/jpeg" });
const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

describe("uploadWizardPhoto", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("passes the server's reason through", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({ error: "Photo must be a JPG or PNG" }, false));
    expect(await uploadWizardPhoto(photo)).toEqual({ ok: false, error: "Photo must be a JPG or PNG" });
  });

  it("returns Upload failed when the storage PUT fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ uploadUrl: "https://r2/put", key: "wizard-photos/u1/a/original" }))
      .mockResolvedValueOnce({ ok: false } as Response);
    expect(await uploadWizardPhoto(photo)).toEqual({ ok: false, error: "Upload failed" });
  });

  it("returns the shrunk photo key", async () => {
    const f = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ uploadUrl: "https://r2/put", key: "wizard-photos/u1/a/original" }))
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce(json({ photoKey: "wizard-photos/u1/a/photo.jpg" }));
    expect(await uploadWizardPhoto(photo)).toEqual({ ok: true, photoKey: "wizard-photos/u1/a/photo.jpg" });
    expect(f.mock.calls[2][0]).toBe("/api/wizard-photo");
    expect(JSON.parse(f.mock.calls[2][1]!.body as string)).toEqual({ key: "wizard-photos/u1/a/original" });
  });
});
