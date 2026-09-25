import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { removeFromChecklist, deleteDocumentPermanently } from "@/lib/document-actions";

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

const ok = () => ({ ok: true, json: async () => ({ ok: true }) });
const fail = (error?: string) => ({ ok: false, json: async () => (error ? { error } : {}) });

describe("removeFromChecklist", () => {
  it("POSTs to the remove route and returns null on success", async () => {
    fetchMock.mockResolvedValue(ok());
    expect(await removeFromChecklist("d1")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/documents/d1/remove", { method: "POST" });
  });

  it("returns the server's error message, or a fallback", async () => {
    fetchMock.mockResolvedValue(fail("Only documents still in review can be removed"));
    expect(await removeFromChecklist("d1")).toBe("Only documents still in review can be removed");
    fetchMock.mockResolvedValue(fail());
    expect(await removeFromChecklist("d1")).toBe("Couldn't remove this document. Please try again.");
  });
});

describe("deleteDocumentPermanently", () => {
  it("DELETEs with the reason and returns null on success", async () => {
    fetchMock.mockResolvedValue(ok());
    expect(await deleteDocumentPermanently("d1", "Another client's paperwork")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/documents/d1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Another client's paperwork" }),
    });
  });

  it("returns the server's error message, or a fallback", async () => {
    fetchMock.mockResolvedValue(fail("A reason is required"));
    expect(await deleteDocumentPermanently("d1", "")).toBe("A reason is required");
    fetchMock.mockResolvedValue(fail());
    expect(await deleteDocumentPermanently("d1", "x")).toBe("Couldn't delete this document. Please try again.");
  });
});
