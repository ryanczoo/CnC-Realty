import { describe, it, expect } from "vitest";
import { SIDES } from "@/app/(dashboard)/dashboard/transactions/new-transaction/page";
import { ROLE_LABELS } from "@/types/transaction";

describe("TransactionSide values", () => {
  it("SIDES has all 7 types with correct values", () => {
    const values = SIDES.map((s) => s.value);
    expect(values).toEqual(["PURCHASE", "LISTING", "DUAL", "LEASE_TENANT", "LEASE_LANDLORD", "LEASE_DUAL", "REFERRAL"]);
  });

  it("SIDES no longer contains the old mislabeled Referral/Other option", () => {
    const referralOther = SIDES.find((s) => (s.label as string) === "Referral / Other");
    expect(referralOther).toBeUndefined();
  });

  it("ROLE_LABELS maps every side to the correct role label", () => {
    expect(ROLE_LABELS.PURCHASE).toBe("Buyer's Agent");
    expect(ROLE_LABELS.LISTING).toBe("Listing Agent");
    expect(ROLE_LABELS.DUAL).toBe("Dual Agent");
    expect(ROLE_LABELS.LEASE_TENANT).toBe("Buyer's Agent");
    expect(ROLE_LABELS.LEASE_LANDLORD).toBe("Listing Agent");
    expect(ROLE_LABELS.LEASE_DUAL).toBe("Dual Agent");
    expect(ROLE_LABELS.REFERRAL).toBe("Referral Agent");
  });
});
