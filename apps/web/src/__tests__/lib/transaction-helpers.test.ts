import { describe, it, expect } from "vitest";
import { calcReferralFee, canTransitionTransaction, pickDisplayPrice, escrowTypeToRole } from "@/lib/transaction-helpers";

describe("calcReferralFee", () => {
  it("takes 10% when 10% of the amount exceeds $200", () => {
    expect(calcReferralFee(5000)).toEqual({ cncFee: 500, agentNet: 4500 });
  });

  it("takes the $200 floor when 10% of the amount is under $200", () => {
    expect(calcReferralFee(1000)).toEqual({ cncFee: 200, agentNet: 800 });
  });

  it("takes exactly $200 at the breakeven point", () => {
    expect(calcReferralFee(2000)).toEqual({ cncFee: 200, agentNet: 1800 });
  });
});

describe("referral status transitions", () => {
  it("agent can move PENDING to REFERRAL_SUCCESSFUL", () => {
    expect(canTransitionTransaction("PENDING", "REFERRAL_SUCCESSFUL", "AGENT")).toBe(true);
  });

  it("agent can move PENDING to REFERRAL_UNSUCCESSFUL", () => {
    expect(canTransitionTransaction("PENDING", "REFERRAL_UNSUCCESSFUL", "AGENT")).toBe(true);
  });

  it("agent cannot move REFERRAL_SUCCESSFUL to REFERRAL_BROKER_REVIEW", () => {
    expect(canTransitionTransaction("REFERRAL_SUCCESSFUL", "REFERRAL_BROKER_REVIEW", "AGENT")).toBe(false);
  });

  it("admin can move REFERRAL_SUCCESSFUL to REFERRAL_BROKER_REVIEW", () => {
    expect(canTransitionTransaction("REFERRAL_SUCCESSFUL", "REFERRAL_BROKER_REVIEW", "ADMIN")).toBe(true);
  });

  it("admin can close from REFERRAL_BROKER_REVIEW", () => {
    expect(canTransitionTransaction("REFERRAL_BROKER_REVIEW", "CLOSED", "ADMIN")).toBe(true);
  });

  it("admin can close directly from REFERRAL_UNSUCCESSFUL", () => {
    expect(canTransitionTransaction("REFERRAL_UNSUCCESSFUL", "CLOSED", "ADMIN")).toBe(true);
  });

  it("admin can also move PENDING to REFERRAL_SUCCESSFUL (admin has full agent-level control)", () => {
    expect(canTransitionTransaction("PENDING", "REFERRAL_SUCCESSFUL", "ADMIN")).toBe(true);
  });

  it("admin can also move PENDING to REFERRAL_UNSUCCESSFUL (admin has full agent-level control)", () => {
    expect(canTransitionTransaction("PENDING", "REFERRAL_UNSUCCESSFUL", "ADMIN")).toBe(true);
  });

  it("admin retains every admin-only transition after gaining agent-level access (no narrowing)", () => {
    expect(canTransitionTransaction("PENDING", "CLOSED", "ADMIN")).toBe(true);
    expect(canTransitionTransaction("PENDING", "EXPIRED", "ADMIN")).toBe(true);
    expect(canTransitionTransaction("REFERRAL_SUCCESSFUL", "REFERRAL_BROKER_REVIEW", "ADMIN")).toBe(true);
  });

  it("agent still cannot do admin-only transitions after this change (union is one-directional)", () => {
    expect(canTransitionTransaction("PENDING", "CLOSED", "AGENT")).toBe(false);
    expect(canTransitionTransaction("REFERRAL_SUCCESSFUL", "REFERRAL_BROKER_REVIEW", "AGENT")).toBe(false);
  });
});

describe("pickDisplayPrice", () => {
  it("transactions show the sale price, the price it went into contract for", () => {
    expect(pickDisplayPrice("transaction", { listPrice: 850000, salePrice: 800000 })).toBe(800000);
  });

  it("transactions fall back to the list price when there is no sale price yet", () => {
    expect(pickDisplayPrice("transaction", { listPrice: 850000, salePrice: null })).toBe(850000);
  });

  it("listings always show the list price (they have no sale price)", () => {
    expect(pickDisplayPrice("listing", { listPrice: 2500000, salePrice: 2400000 })).toBe(2500000);
  });

  it("returns null when there is no price at all", () => {
    expect(pickDisplayPrice("transaction", {})).toBeNull();
    expect(pickDisplayPrice("listing", { listPrice: null })).toBeNull();
  });
});

describe("escrowTypeToRole", () => {
  it("maps each Title/Escrow/Attorney choice to its own party role", () => {
    expect(escrowTypeToRole("Title")).toBe("TITLE");
    expect(escrowTypeToRole("Escrow")).toBe("ESCROW");
    expect(escrowTypeToRole("Attorney")).toBe("ATTORNEY");
  });
});
