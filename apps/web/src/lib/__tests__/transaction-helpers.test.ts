import { describe, it, expect } from "vitest";
import {
  canTransitionListing,
  canTransitionTransaction,
  getChecklistProgress,
} from "../transaction-helpers";
import type { FileChecklistItemWithDocs } from "@/types/transaction";

describe("canTransitionListing", () => {
  it("allows INCOMPLETE → ACTIVE", () => {
    expect(canTransitionListing("INCOMPLETE", "ACTIVE", "AGENT")).toBe(true);
  });
  it("blocks ACTIVE → CLOSED by agent", () => {
    expect(canTransitionListing("ACTIVE", "CLOSED", "AGENT")).toBe(false);
  });
  it("allows ACTIVE → CLOSED by admin", () => {
    expect(canTransitionListing("ACTIVE", "CLOSED", "ADMIN")).toBe(true);
  });
  it("blocks invalid transition CLOSED → ACTIVE", () => {
    expect(canTransitionListing("CLOSED", "ACTIVE", "ADMIN")).toBe(false);
  });
});

describe("canTransitionTransaction", () => {
  it("allows INCOMPLETE → PRE_CONTRACT by agent", () => {
    expect(canTransitionTransaction("INCOMPLETE", "PRE_CONTRACT", "AGENT")).toBe(true);
  });
  it("blocks PENDING → CLOSED by agent", () => {
    expect(canTransitionTransaction("PENDING", "CLOSED", "AGENT")).toBe(false);
  });
  it("allows PENDING → CLOSED by admin", () => {
    expect(canTransitionTransaction("PENDING", "CLOSED", "ADMIN")).toBe(true);
  });
});

describe("getChecklistProgress", () => {
  const makeItem = (isRequired: boolean, reviewStatus: string | null): FileChecklistItemWithDocs => ({
    id: "1",
    name: "Test",
    isRequired,
    documents: reviewStatus ? [{ reviewStatus } as any] : [],
  });

  it("returns 0/0 when no required items", () => {
    const result = getChecklistProgress([makeItem(false, "APPROVED")]);
    expect(result).toEqual({ satisfied: 0, required: 0 });
  });
  it("counts satisfied when doc is APPROVED", () => {
    const result = getChecklistProgress([makeItem(true, "APPROVED"), makeItem(true, null)]);
    expect(result).toEqual({ satisfied: 1, required: 2 });
  });
  it("counts PENDING_REVIEW as satisfied for submit eligibility", () => {
    const result = getChecklistProgress([makeItem(true, "PENDING_REVIEW")]);
    expect(result).toEqual({ satisfied: 1, required: 1 });
  });
  it("does not count REJECTED as satisfied", () => {
    const result = getChecklistProgress([makeItem(true, "REJECTED")]);
    expect(result).toEqual({ satisfied: 0, required: 1 });
  });
});
