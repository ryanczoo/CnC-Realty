import { describe, it, expect, vi, afterEach } from "vitest";
import { savedPropertiesKey, fetchSavedMlsNumbers, withToggled } from "@/lib/saved-properties";

afterEach(() => vi.unstubAllGlobals());

describe("savedPropertiesKey", () => {
  // One cache entry per signed-in user, so every heart on the page reads the same list
  // and one user's saves never show for another user on a shared device.
  it("is the same for the same user and different per user", () => {
    expect(savedPropertiesKey("u1")).toEqual(savedPropertiesKey("u1"));
    expect(savedPropertiesKey("u1")).not.toEqual(savedPropertiesKey("u2"));
  });
});

describe("fetchSavedMlsNumbers", () => {
  it("returns the saved MLS numbers as a set", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ mlsNumbers: ["A", "B"] }) })));
    const set = await fetchSavedMlsNumbers();
    expect(Array.from(set)).toEqual(["A", "B"]);
    expect(fetch).toHaveBeenCalledWith("/api/saved-properties");
  });

  it("throws when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    await expect(fetchSavedMlsNumbers()).rejects.toThrow();
  });
});

describe("withToggled", () => {
  it("adds a listing that isn't saved and removes one that is, without changing the original", () => {
    const start = new Set(["A"]);
    expect(Array.from(withToggled(start, "B")).sort()).toEqual(["A", "B"]);
    expect(Array.from(withToggled(start, "A"))).toEqual([]);
    expect(Array.from(start)).toEqual(["A"]);
  });

  it("treats a missing list as empty", () => {
    expect(Array.from(withToggled(undefined, "A"))).toEqual(["A"]);
  });
});
