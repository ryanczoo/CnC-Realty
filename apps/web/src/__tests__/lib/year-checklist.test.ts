import { describe, it, expect } from "vitest";
import { builtBeforeApplies, checklistCreateData, planYearChecklistChange, shortItemName, type TemplateItemLike } from "@/lib/year-checklist";

const LPD = "LPD — Lead-Based Paint and Lead-Based Paint Hazards Disclosure";
const EQ = "Residential Earthquake Hazards Report (Homeowner's Guide to Earthquake Safety)";
const items: TemplateItemLike[] = [
  { name: "RLA", description: null, order: 1, isRequired: true, builtBefore: null },
  { name: LPD, description: "lead", order: 2, isRequired: true, builtBefore: 1978 },
  { name: EQ, description: "eq", order: 3, isRequired: true, builtBefore: 1960 },
];
const row = (id: string, name: string, isRequired = true, documentCount = 0) => ({ id, name, isRequired, documentCount });

describe("builtBeforeApplies", () => {
  it("no year limit applies everywhere; a limit needs a known, earlier year", () => {
    expect(builtBeforeApplies(null, null)).toBe(true);
    expect(builtBeforeApplies(1978, 1977)).toBe(true);
    expect(builtBeforeApplies(1978, 1978)).toBe(false);
    expect(builtBeforeApplies(1978, null)).toBe(false);
  });
});

describe("checklistCreateData", () => {
  it("keeps only items that apply, with their order and builtBefore", () => {
    expect(checklistCreateData("LISTING", items, 1952).map((i) => [i.name, i.order, i.builtBefore])).toEqual([
      ["RLA", 1, null], [LPD, 2, 1978], [EQ, 3, 1960],
    ]);
    expect(checklistCreateData("TRANSACTION", items, 1970).map((i) => i.name)).toEqual(["RLA", LPD]);
    expect(checklistCreateData("TRANSACTION", items, null).map((i) => i.name)).toEqual(["RLA"]);
    expect(checklistCreateData("LISTING", items, 2005)[0]).toEqual({ fileType: "LISTING", name: "RLA", description: null, order: 1, isRequired: true, builtBefore: null });
  });
});

describe("planYearChecklistChange", () => {
  it("adds year items that now apply", () => {
    const p = planYearChecklistChange(items, [row("a", "RLA")], 1952);
    expect(p.add.map((i) => i.name)).toEqual([LPD, EQ]);
    expect(p.removeIds).toEqual([]);
  });
  it("removes a year row that no longer applies when it has no document", () => {
    expect(planYearChecklistChange(items, [row("a", "RLA"), row("l", LPD)], 2005).removeIds).toEqual(["l"]);
  });
  it("never removes a row with a document (any review state)", () => {
    expect(planYearChecklistChange(items, [row("l", LPD, true, 1)], 2005).removeIds).toEqual([]);
  });
  it("turns an existing optional row of the same name into the required year row", () => {
    const p = planYearChecklistChange(items, [row("l", LPD, false)], 1950);
    expect(p.requiredUpdates).toEqual([{ id: "l", isRequired: true, builtBefore: 1978 }]);
    expect(p.add.map((i) => i.name)).toEqual([EQ]);
  });
  it("does not change a row that has a document even if its required flag differs", () => {
    expect(planYearChecklistChange(items, [row("l", LPD, false, 2)], 1950).requiredUpdates).toEqual([]);
  });
  it("unknown year: adds nothing, removes year rows without documents", () => {
    const p = planYearChecklistChange(items, [row("l", LPD), row("e", EQ, true, 1)], null);
    expect(p.add).toEqual([]);
    expect(p.removeIds).toEqual(["l"]);
  });
  it("never touches items without a year limit", () => {
    const p = planYearChecklistChange(items, [], 2005);
    expect(p).toEqual({ add: [], removeIds: [], requiredUpdates: [] });
    const q = planYearChecklistChange(items, [row("a", "RLA", false)], 1950);
    expect(q.requiredUpdates).toEqual([]);
  });
  it("running on its own result changes nothing", () => {
    const p = planYearChecklistChange(items, [row("a", "RLA"), row("l", LPD), row("e", EQ)], 1952);
    expect(p).toEqual({ add: [], removeIds: [], requiredUpdates: [] });
  });
});

describe("shortItemName", () => {
  it("shortens for the activity line", () => {
    expect(shortItemName(LPD)).toBe("LPD");
    expect(shortItemName(EQ)).toBe("Residential Earthquake Hazards Report");
    expect(shortItemName("TDS")).toBe("TDS");
  });
});
