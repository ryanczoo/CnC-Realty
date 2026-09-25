import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { saveFileField } from "@/lib/file-actions";

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("saveFileField", () => {
  it("PATCHes one field to the listing route and returns null on success", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await saveFileField("listing", "l1", "listPrice", "950000")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/listings/l1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listPrice: "950000" }),
    });
  });

  it("uses the transaction route for transactions", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await saveFileField("transaction", "t1", "closeOfEscrow", "2026-10-20");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/transactions/t1");
  });

  it("returns the server's error, or a fallback", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Sale Price can't be blank" }) });
    expect(await saveFileField("transaction", "t1", "salePrice", "")).toBe("Sale Price can't be blank");
    fetchMock.mockResolvedValue({ ok: false, json: async () => { throw new Error("no body"); } });
    expect(await saveFileField("transaction", "t1", "salePrice", "")).toBe("Couldn't save this change. Please try again.");
  });
});
