import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchListings, fetchTransactions, fetchOpenTasks, fetchCompletedTasks, removeTaskById, updateDealInList, removeDealFromList, fetchDeals } from "@/lib/dashboard-queries";

describe("fetchListings", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("returns the listings array from a successful response", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ listings: [{ id: "l1" }] }),
    } as any);

    const result = await fetchListings();
    expect(result).toEqual([{ id: "l1" }]);
    expect(global.fetch).toHaveBeenCalledWith("/api/listings");
  });

  it("returns an empty array when the response has no listings field", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as any);

    const result = await fetchListings();
    expect(result).toEqual([]);
  });

  it("throws when the response is not ok", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false } as any);

    await expect(fetchListings()).rejects.toThrow();
  });
});

describe("fetchTransactions", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("returns the transactions array from a successful response", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ transactions: [{ id: "t1" }] }),
    } as any);

    const result = await fetchTransactions();
    expect(result).toEqual([{ id: "t1" }]);
    expect(global.fetch).toHaveBeenCalledWith("/api/transactions");
  });

  it("throws when the response is not ok", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false } as any);

    await expect(fetchTransactions()).rejects.toThrow();
  });
});

describe("fetchOpenTasks", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("fetches done=false tasks and returns the parsed array", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "t1", done: false }]),
    } as any);

    const result = await fetchOpenTasks();
    expect(result).toEqual([{ id: "t1", done: false }]);
    expect(global.fetch).toHaveBeenCalledWith("/api/tasks?done=false");
  });

  it("throws when the response is not ok", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false } as any);
    await expect(fetchOpenTasks()).rejects.toThrow();
  });
});

describe("fetchCompletedTasks", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("fetches done=true tasks and returns the parsed array", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "t2", done: true }]),
    } as any);

    const result = await fetchCompletedTasks();
    expect(result).toEqual([{ id: "t2", done: true }]);
    expect(global.fetch).toHaveBeenCalledWith("/api/tasks?done=true");
  });
});

describe("removeTaskById", () => {
  it("returns a new array with the matching task removed", () => {
    const tasks = [{ id: "t1" }, { id: "t2" }, { id: "t3" }];
    const result = removeTaskById(tasks, "t2");
    expect(result).toEqual([{ id: "t1" }, { id: "t3" }]);
  });

  it("returns an equivalent array when the id isn't present", () => {
    const tasks = [{ id: "t1" }, { id: "t2" }];
    const result = removeTaskById(tasks, "missing");
    expect(result).toEqual(tasks);
  });

  it("returns an empty array when given undefined", () => {
    expect(removeTaskById(undefined, "t1")).toEqual([]);
  });
});

describe("updateDealInList", () => {
  it("replaces the matching deal, leaving others untouched", () => {
    const deals = [{ id: "d1", stage: "A" }, { id: "d2", stage: "B" }];
    const result = updateDealInList(deals, { id: "d2", stage: "C" });
    expect(result).toEqual([{ id: "d1", stage: "A" }, { id: "d2", stage: "C" }]);
  });

  it("returns an equivalent list unchanged when the id isn't present", () => {
    const deals = [{ id: "d1", stage: "A" }];
    const result = updateDealInList(deals, { id: "missing", stage: "C" });
    expect(result).toEqual(deals);
  });

  it("returns an empty array when given undefined", () => {
    expect(updateDealInList(undefined, { id: "d1", stage: "A" })).toEqual([]);
  });
});

describe("fetchDeals", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("fetches deals for the given pipeline and returns the parsed array", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "d1", pipeline: "BUYERS" }]),
    } as any);

    const result = await fetchDeals("BUYERS");
    expect(result).toEqual([{ id: "d1", pipeline: "BUYERS" }]);
    expect(global.fetch).toHaveBeenCalledWith("/api/deals?pipeline=BUYERS");
  });

  it("throws when the response is not ok", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false } as any);
    await expect(fetchDeals("SELLERS")).rejects.toThrow();
  });
});

describe("removeDealFromList", () => {
  it("removes the matching deal", () => {
    const deals = [{ id: "d1" }, { id: "d2" }];
    expect(removeDealFromList(deals, "d1")).toEqual([{ id: "d2" }]);
  });

  it("returns an empty array when given undefined", () => {
    expect(removeDealFromList(undefined, "d1")).toEqual([]);
  });
});
