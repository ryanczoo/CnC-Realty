import { describe, it, expect } from "vitest";
import { convertChoiceCards } from "@/lib/convert-choices";

describe("convertChoiceCards", () => {
  it("offers Listing + Both Purchase & Listing for a sale listing", () => {
    expect(convertChoiceCards("RESIDENTIAL_SALE")).toEqual([
      { value: "LISTING", label: "Listing", desc: "Seller representation" },
      { value: "DUAL", label: "Both Purchase & Listing", desc: "Dual agency transaction" },
    ]);
  });
  it("offers Lease Landlord + Both Lease Tenant & Landlord for a lease listing", () => {
    expect(convertChoiceCards("COMMERCIAL_LEASE")).toEqual([
      { value: "LEASE_LANDLORD", label: "Lease Landlord", desc: "Homeowner representation" },
      { value: "LEASE_DUAL", label: "Both Lease Tenant & Landlord", desc: "Dual agency - lease transaction" },
    ]);
  });
});
