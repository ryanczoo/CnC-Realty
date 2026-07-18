import { describe, it, expect } from "vitest";
import { COMMERCIAL_TYPES, isCommercialPropertyType, getDisplayPropertyType } from "@/types/property";

describe("COMMERCIAL_TYPES / isCommercialPropertyType", () => {
  it("treats every known commercial CRMLS PropertySubType as commercial", () => {
    for (const t of COMMERCIAL_TYPES) {
      expect(isCommercialPropertyType(t)).toBe(true);
    }
  });

  it("treats residential types as not commercial", () => {
    expect(isCommercialPropertyType("SingleFamilyResidence")).toBe(false);
    expect(isCommercialPropertyType("Condominium")).toBe(false);
    expect(isCommercialPropertyType("Townhouse")).toBe(false);
    expect(isCommercialPropertyType("MultiFamily")).toBe(false);
    expect(isCommercialPropertyType("Land")).toBe(false);
  });

  it("treats null as not commercial", () => {
    expect(isCommercialPropertyType(null)).toBe(false);
  });
});

describe("getDisplayPropertyType", () => {
  it("folds Warehouse into Industrial", () => {
    expect(getDisplayPropertyType("Warehouse")).toBe("Industrial");
  });

  it("folds Business into BusinessOpportunity", () => {
    expect(getDisplayPropertyType("Business")).toBe("BusinessOpportunity");
  });

  it("passes through every other type unchanged", () => {
    expect(getDisplayPropertyType("Office")).toBe("Office");
    expect(getDisplayPropertyType("Industrial")).toBe("Industrial");
    expect(getDisplayPropertyType("BusinessOpportunity")).toBe("BusinessOpportunity");
    expect(getDisplayPropertyType("SingleFamilyResidence")).toBe("SingleFamilyResidence");
  });
});
