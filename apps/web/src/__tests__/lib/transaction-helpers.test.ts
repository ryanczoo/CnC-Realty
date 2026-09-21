import { describe, it, expect } from "vitest";
import { calcReferralFee, canTransitionTransaction, pickDisplayPrice, escrowTypeToRole, latestDocument, allowedNextStatuses, canTransitionListing } from "@/lib/transaction-helpers";

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

describe("latestDocument", () => {
  const doc = (id: string, uploadedAt: string, reviewStatus: "APPROVED" | "REJECTED" | "PENDING_REVIEW") => ({ id, uploadedAt, reviewStatus });

  it("returns undefined when a checklist row has no documents", () => {
    expect(latestDocument([])).toBeUndefined();
  });

  it("returns the most recently uploaded document even when it is not first in the list", () => {
    const docs = [
      doc("old-approved", "2026-09-21T01:16:35.279Z", "APPROVED"),
      doc("new-pending", "2026-09-21T14:37:57.349Z", "PENDING_REVIEW"),
    ];
    expect(latestDocument(docs)?.id).toBe("new-pending");
  });

  it("returns the newest document when the list is newest-first, too", () => {
    const docs = [
      doc("newest-approved", "2026-09-21T02:09:31.657Z", "APPROVED"),
      doc("older-rejected", "2026-09-21T02:03:27.552Z", "REJECTED"),
    ];
    expect(latestDocument(docs)?.id).toBe("newest-approved");
  });

  it("does not reorder the array it was given", () => {
    const docs = [doc("a", "2026-01-01T00:00:00Z", "APPROVED"), doc("b", "2026-02-01T00:00:00Z", "APPROVED")];
    latestDocument(docs);
    expect(docs.map((d) => d.id)).toEqual(["a", "b"]);
  });
});

describe("allowedNextStatuses", () => {
  const LISTING_STATUSES = ["INCOMPLETE", "PENDING_TRANSFER", "COMING_SOON", "ACTIVE", "ACTIVE_UNDER_CONTRACT", "EXPIRED", "WITHDRAWN", "CANCELED", "CLOSED"];
  const TX_STATUSES = ["INCOMPLETE", "PENDING_TRANSFER", "PRE_CONTRACT", "PENDING", "EXPIRED", "CLOSED", "ARCHIVED", "CANCELED_PENDING", "CANCELED_APPROVED", "REFERRAL_SUCCESSFUL", "REFERRAL_UNSUCCESSFUL", "REFERRAL_BROKER_REVIEW"];

  it.each(["ADMIN", "AGENT"] as const)("matches canTransitionTransaction exactly for every %s move", (role) => {
    for (const from of TX_STATUSES) {
      const allowed = allowedNextStatuses("transaction", from, role);
      for (const to of TX_STATUSES) {
        expect(allowed.includes(to), `${from} -> ${to} as ${role}`).toBe(canTransitionTransaction(from as any, to as any, role));
      }
    }
  });

  it.each(["ADMIN", "AGENT"] as const)("matches canTransitionListing exactly for every %s move", (role) => {
    for (const from of LISTING_STATUSES) {
      const allowed = allowedNextStatuses("listing", from, role);
      for (const to of LISTING_STATUSES) {
        expect(allowed.includes(to), `${from} -> ${to} as ${role}`).toBe(canTransitionListing(from as any, to as any, role));
      }
    }
  });

  it("offers an admin the move from PENDING to CLOSED", () => {
    expect(allowedNextStatuses("transaction", "PENDING", "ADMIN")).toContain("CLOSED");
  });

  it("does not offer an agent the move from PENDING to CLOSED", () => {
    expect(allowedNextStatuses("transaction", "PENDING", "AGENT")).not.toContain("CLOSED");
  });

  it("offers nothing for an unknown status and never repeats a status", () => {
    expect(allowedNextStatuses("transaction", "NOPE", "ADMIN")).toEqual([]);
    const list = allowedNextStatuses("transaction", "PENDING", "ADMIN");
    expect(new Set(list).size).toBe(list.length);
  });
});
