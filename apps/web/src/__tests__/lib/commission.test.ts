import { describe, it, expect } from "vitest";
import { TC_FEE, calcEoSupplement, calcTransactionFee, calcNetToAgent } from "@/lib/commission";

describe("calcEoSupplement", () => {
  it("is 0 at or under the $1M threshold", () => {
    expect(calcEoSupplement(1_000_000)).toBe(0);
    expect(calcEoSupplement(500_000)).toBe(0);
  });

  it("is $400 for the first increment over $1M", () => {
    expect(calcEoSupplement(1_100_000)).toBe(400);
    expect(calcEoSupplement(1_500_000)).toBe(400);
  });

  it("is $800 in the $1.5M-$2M tier", () => {
    expect(calcEoSupplement(1_500_001)).toBe(800);
    expect(calcEoSupplement(2_000_000)).toBe(800);
  });

  it("is $1,200 in the $2M-$2.5M tier", () => {
    expect(calcEoSupplement(2_000_001)).toBe(1200);
    expect(calcEoSupplement(2_500_000)).toBe(1200);
  });

  it("rounds a fraction of a $500k increment up to a full increment", () => {
    expect(calcEoSupplement(1_000_001)).toBe(400);
  });
});

describe("calcTransactionFee", () => {
  const base = {
    side: "PURCHASE",
    salePrice: 500_000,
    grossCommission: 15_000,
    agentRelativeSale: false,
    brokerProvidedLead: false,
    numberOfParcels: null,
  };

  it("is the flat $990 base fee on a plain sale under $1M", () => {
    const result = calcTransactionFee(base);
    expect(result.fee).toBe(990);
    expect(result.label).toBe("CnC Transaction Fee");
  });

  it("adds the E&O supplement above $1M", () => {
    const result = calcTransactionFee({ ...base, salePrice: 1_200_000 });
    expect(result.fee).toBe(990 + 400);
  });

  it("doubles the fee for a DUAL-side transaction", () => {
    const result = calcTransactionFee({ ...base, side: "DUAL" });
    expect(result.fee).toBe(990 * 2);
    expect(result.label).toBe("CnC Transaction Fee (Dual ×2)");
  });

  it("doubles the fee for an agent-relative sale on a non-dual side", () => {
    const result = calcTransactionFee({ ...base, agentRelativeSale: true });
    expect(result.fee).toBe(990 * 2);
    expect(result.label).toBe("CnC Transaction Fee (Dual ×2)");
  });

  it("multiplies the fee by parcel count when numberOfParcels is 2 or more", () => {
    const result = calcTransactionFee({ ...base, numberOfParcels: 3 });
    expect(result.fee).toBe(990 * 3);
    expect(result.label).toBe("CnC Transaction Fee (3 Parcels)");
  });

  it("treats numberOfParcels of 1 or null the same as no multi-parcel", () => {
    expect(calcTransactionFee({ ...base, numberOfParcels: 1 }).fee).toBe(990);
    expect(calcTransactionFee({ ...base, numberOfParcels: null }).fee).toBe(990);
  });

  it("compounds dual and multi-parcel on the same file", () => {
    const result = calcTransactionFee({ ...base, side: "DUAL", numberOfParcels: 3 });
    expect(result.fee).toBe(990 * 2 * 3);
    expect(result.label).toBe("CnC Transaction Fee (Dual ×2, 3 Parcels)");
  });

  it("overrides everything to 30% of gross when brokerProvidedLead is on", () => {
    const result = calcTransactionFee({
      ...base,
      side: "DUAL",
      agentRelativeSale: true,
      numberOfParcels: 3,
      brokerProvidedLead: true,
      salePrice: 1_200_000,
      grossCommission: 20_000,
    });
    expect(result.fee).toBe(20_000 * 0.3);
    expect(result.label).toBe("Broker-Provided Lead Fee (30%)");
  });

  it("uses the 10%-or-$200 lease formula for lease sides, ignoring toggles and parcels", () => {
    const result = calcTransactionFee({
      side: "LEASE_TENANT",
      salePrice: 0,
      grossCommission: 3_000,
      agentRelativeSale: true,
      brokerProvidedLead: false,
      numberOfParcels: 5,
    });
    expect(result.fee).toBe(300);
    expect(result.label).toBe("CnC Lease Fee");
  });

  it("floors the lease formula at $200", () => {
    const result = calcTransactionFee({
      side: "LEASE_LANDLORD",
      salePrice: 0,
      grossCommission: 1_000,
      agentRelativeSale: false,
      brokerProvidedLead: false,
      numberOfParcels: null,
    });
    expect(result.fee).toBe(200);
  });

  it("applies the lease formula the same way for LEASE_DUAL", () => {
    const result = calcTransactionFee({
      side: "LEASE_DUAL",
      salePrice: 0,
      grossCommission: 3_000,
      agentRelativeSale: false,
      brokerProvidedLead: false,
      numberOfParcels: null,
    });
    expect(result.fee).toBe(300);
  });
});

describe("calcNetToAgent", () => {
  it("subtracts the transaction fee, deductions, and no TC fee", () => {
    expect(calcNetToAgent(10000, 990, 500, false)).toBe(10000 - 990 - 500);
  });

  it("also subtracts the TC fee when enabled", () => {
    expect(calcNetToAgent(10000, 990, 500, true)).toBe(10000 - 990 - 500 - TC_FEE);
  });

  it("handles zero deductions and zero transaction fee", () => {
    expect(calcNetToAgent(5000, 0, 0, false)).toBe(5000);
  });
});
