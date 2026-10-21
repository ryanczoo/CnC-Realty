import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadDocument } from "@/hooks/useFileUpload";

const file = new File(["x"], "Pest Inspection Report.pdf", { type: "application/pdf" });
const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

describe("uploadDocument", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns the server's reason when the upload URL is refused", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      json({ error: "File type not allowed. Use PDF, JPG, PNG, or DOCX." }, false),
    );
    expect(await uploadDocument("LISTING", "l1", null, file)).toEqual({
      name: "Pest Inspection Report.pdf",
      ok: false,
      error: "File type not allowed. Use PDF, JPG, PNG, or DOCX.",
    });
  });

  it("returns Upload failed when the storage PUT fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ uploadUrl: "https://r2/put", key: "k", documentId: "d" }))
      .mockResolvedValueOnce({ ok: false } as Response);
    expect(await uploadDocument("LISTING", "l1", "c1", file)).toEqual({
      name: "Pest Inspection Report.pdf", ok: false, error: "Upload failed",
    });
  });

  it("returns the server's reason when registering the document fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ uploadUrl: "https://r2/put", key: "k", documentId: "d" }))
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce(json({ error: "This file is locked" }, false));
    expect(await uploadDocument("TRANSACTION", "t1", null, file)).toEqual({
      name: "Pest Inspection Report.pdf", ok: false, error: "This file is locked",
    });
  });

  it("returns ok with the file name on success", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ uploadUrl: "https://r2/put", key: "k", documentId: "d" }))
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce(json({ document: { id: "d" } }));
    expect(await uploadDocument("LISTING", "l1", null, file)).toEqual({ name: "Pest Inspection Report.pdf", ok: true });
  });
});
