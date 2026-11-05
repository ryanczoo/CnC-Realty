import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { saveFileField, saveFileFields, changeRepresentation } from "@/lib/file-actions";

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

describe("saveFileFields", () => {
  it("PATCHes several fields at once", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await saveFileFields("listing", "l1", { commissionAmount: "15000", commissionPercent: "" })).toBeNull();
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ commissionAmount: "15000", commissionPercent: "" }));
  });
});

describe("changeRepresentation", () => {
  it("POSTs the new side to the representation route and returns null on success", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ transactionFile: {} }) });
    expect(await changeRepresentation("t1", "DUAL")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/transactions/t1/representation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionSide: "DUAL" }),
    });
  });

  it("returns the server's error text, or a fallback", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "That change isn't allowed." }) });
    expect(await changeRepresentation("t1", "REFERRAL")).toBe("That change isn't allowed.");
    fetchMock.mockResolvedValue({ ok: false, json: async () => { throw new Error("no body"); } });
    expect(await changeRepresentation("t1", "DUAL")).toBe("Couldn't save this change. Please try again.");
  });
});

describe("fetchImpl", () => {
  const okSpy = () => vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

  it("saveFileField sends the PATCH through the given fetch", async () => {
    const spy = okSpy();
    expect(await saveFileField("transaction", "t1", "salePrice", "5", spy)).toBeNull();
    expect(spy).toHaveBeenCalledWith("/api/transactions/t1", expect.objectContaining({ method: "PATCH" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saveFileFields and changeRepresentation use the given fetch", async () => {
    const spy = okSpy();
    await saveFileFields("listing", "l1", { listPrice: "1" }, spy);
    await changeRepresentation("t1", "DUAL", spy);
    expect(spy).toHaveBeenCalledWith("/api/listings/l1", expect.objectContaining({ method: "PATCH" }));
    expect(spy).toHaveBeenCalledWith("/api/transactions/t1/representation", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to global fetch when none is given", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await changeRepresentation("t1", "DUAL");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
