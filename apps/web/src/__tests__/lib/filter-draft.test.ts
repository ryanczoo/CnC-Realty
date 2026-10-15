import { describe, it, expect } from "vitest";
import { draftValue, draftChanges } from "@/lib/filter-draft";
import { DEFAULT_FILTERS } from "@/types/property";

const filters = { ...DEFAULT_FILTERS, query: "Pasadena", minBeds: "2" };

describe("filter draft", () => {
  it("shows the draft pick, else the applied filter", () => {
    expect(draftValue({}, filters, "minBeds")).toBe("2");
    expect(draftValue({ minBeds: "3" }, filters, "minBeds")).toBe("3");
    expect(draftValue({ minBeds: "" }, filters, "minBeds")).toBe("");
  });
  it("Apply sends only real changes", () => {
    expect(draftChanges({ minBeds: "3" }, filters)).toEqual({ minBeds: "3" });
    expect(draftChanges({ minBeds: "2" }, filters)).toEqual({});
    expect(draftChanges({ minBeds: "" }, filters)).toEqual({ minBeds: "" });
  });
  it("closing without Apply = an empty draft = no change", () => {
    expect(draftChanges({}, filters)).toEqual({});
  });
});
