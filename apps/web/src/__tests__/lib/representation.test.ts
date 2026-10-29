import { describe, it, expect } from "vitest";
import {
  convertSideChoices,
  representationGroup,
  canChangeRepresentation,
  templateItemsForFile,
  planRepresentationChange,
  representationPencilSides,
} from "@/lib/representation";
import type { TemplateItemLike, FileRowLike } from "@/lib/year-checklist";

const item = (name: string, o: Partial<TemplateItemLike> = {}): TemplateItemLike => ({
  name, description: null, order: 0, isRequired: true, builtBefore: null, ...o,
});
const row = (id: string, name: string, o: Partial<FileRowLike> = {}): FileRowLike => ({
  id, name, isRequired: true, documentCount: 0, ...o,
});

describe("convertSideChoices", () => {
  it("sale types", () => {
    expect(convertSideChoices("RESIDENTIAL_SALE")).toEqual(["LISTING", "DUAL"]);
    expect(convertSideChoices("COMMERCIAL_SALE")).toEqual(["LISTING", "DUAL"]);
  });
  it("lease types", () => {
    expect(convertSideChoices("RESIDENTIAL_LEASE")).toEqual(["LEASE_LANDLORD", "LEASE_DUAL"]);
    expect(convertSideChoices("COMMERCIAL_LEASE")).toEqual(["LEASE_LANDLORD", "LEASE_DUAL"]);
  });
});

describe("representationGroup", () => {
  it("groups", () => {
    expect(representationGroup("DUAL")).toEqual(["PURCHASE", "LISTING", "DUAL"]);
    expect(representationGroup("LEASE_TENANT")).toEqual(["LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL"]);
    expect(representationGroup("REFERRAL")).toBeNull();
    expect(representationGroup("nope")).toBeNull();
  });
});

describe("canChangeRepresentation", () => {
  it("allows within a group", () => {
    expect(canChangeRepresentation("PURCHASE", "DUAL")).toBe(true);
    expect(canChangeRepresentation("LISTING", "PURCHASE")).toBe(true);
    expect(canChangeRepresentation("LEASE_TENANT", "LEASE_DUAL")).toBe(true);
  });
  it("blocks the rest", () => {
    expect(canChangeRepresentation("LISTING", "LEASE_DUAL")).toBe(false);
    expect(canChangeRepresentation("REFERRAL", "PURCHASE")).toBe(false);
    expect(canChangeRepresentation("DUAL", "REFERRAL")).toBe(false);
    expect(canChangeRepresentation("DUAL", "DUAL")).toBe(false);
  });
});

describe("templateItemsForFile", () => {
  const items = [item("RLA", { skipWhenConverted: true }), item("Other")];
  it("drops RLA when converted", () => {
    expect(templateItemsForFile(items, true).map((i) => i.name)).toEqual(["Other"]);
  });
  it("keeps it when not converted", () => {
    expect(templateItemsForFile(items, false).map((i) => i.name)).toEqual(["RLA", "Other"]);
  });
});

describe("planRepresentationChange", () => {
  it("adds missing items", () => {
    const p = planRepresentationChange([item("A"), item("B")], [row("1", "A")], null);
    expect(p.add.map((i) => i.name)).toEqual(["B"]);
  });
  it("removes an empty row not in target", () => {
    expect(planRepresentationChange([item("A")], [row("1", "A"), row("2", "Z")], null).removeIds).toEqual(["2"]);
  });
  it("keeps a row with a document", () => {
    expect(planRepresentationChange([item("A")], [row("2", "Z", { documentCount: 1 })], null).removeIds).toEqual([]);
  });
  it("flips required", () => {
    const p = planRepresentationChange([item("A", { isRequired: false })], [row("1", "A")], null);
    expect(p.requiredUpdates).toEqual([{ id: "1", isRequired: false }]);
  });
  it("ignores inapplicable year items", () => {
    const p = planRepresentationChange([item("LPD", { builtBefore: 1978 })], [], 2000);
    expect(p.add).toEqual([]);
  });
});

describe("representationPencilSides", () => {
  it("offers the family of the file's side", () => {
    expect(representationPencilSides("LISTING", "ACTIVE")).toEqual(["PURCHASE", "LISTING", "DUAL"]);
    expect(representationPencilSides("LEASE_TENANT", "PENDING")).toEqual(["LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL"]);
  });
  it("offers nothing for referrals, unknown sides, or finished/locked files", () => {
    expect(representationPencilSides("REFERRAL", "PENDING")).toBeNull();
    expect(representationPencilSides("???", "PENDING")).toBeNull();
    for (const s of ["CLOSED", "CANCELED_APPROVED", "ARCHIVED", "PENDING_TRANSFER"]) {
      expect(representationPencilSides("PURCHASE", s)).toBeNull();
    }
  });
});
