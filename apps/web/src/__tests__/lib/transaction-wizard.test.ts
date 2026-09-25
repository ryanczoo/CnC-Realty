import { describe, it, expect } from "vitest";
import { transactionDetailsReady } from "@/lib/transaction-wizard";

const sale = { salePrice: "900000", leasePrice: "", acceptanceDate: "2026-09-20", closeOfEscrow: "2026-10-20", leaseSignedDate: "", leaseStartDate: "" };
const lease = { salePrice: "", leasePrice: "36000", acceptanceDate: "", closeOfEscrow: "", leaseSignedDate: "2026-09-20", leaseStartDate: "2026-10-01" };

describe("transactionDetailsReady (New Transaction wizard, Step 2)", () => {
  it("Under Contract sale needs price, Acceptance Date and Close of Escrow", () => {
    expect(transactionDetailsReady(sale, "UNDER_CONTRACT", false)).toBe(true);
    for (const f of ["salePrice", "acceptanceDate", "closeOfEscrow"] as const) {
      expect(transactionDetailsReady({ ...sale, [f]: "" }, "UNDER_CONTRACT", false)).toBe(false);
    }
  });

  it("won't let close of escrow come before acceptance", () => {
    expect(transactionDetailsReady({ ...sale, closeOfEscrow: "2026-09-19" }, "UNDER_CONTRACT", false)).toBe(false);
  });

  it("Under Contract lease needs amount, Lease Signed Date and Lease Start Date", () => {
    expect(transactionDetailsReady(lease, "UNDER_CONTRACT", true)).toBe(true);
    for (const f of ["leasePrice", "leaseSignedDate", "leaseStartDate"] as const) {
      expect(transactionDetailsReady({ ...lease, [f]: "" }, "UNDER_CONTRACT", true)).toBe(false);
    }
  });

  it("Pre-Contract only needs the price (today's rule) — the dates aren't known yet", () => {
    expect(transactionDetailsReady({ ...sale, acceptanceDate: "", closeOfEscrow: "" }, "PRE_CONTRACT", false)).toBe(true);
    expect(transactionDetailsReady({ ...lease, leaseSignedDate: "", leaseStartDate: "" }, "PRE_CONTRACT", true)).toBe(true);
    expect(transactionDetailsReady({ ...sale, salePrice: "" }, "PRE_CONTRACT", false)).toBe(false);
  });
});
