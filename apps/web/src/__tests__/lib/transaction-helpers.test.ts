import { describe, it, expect } from "vitest";
import { calcReferralFee, canTransitionTransaction, pickDisplayPrice, pickDisplayDate, listingStatusOptions, canDeleteListing, convertBlockedReason, sidePartiesReady, isReadyForPending, transactionStatusOptions, escrowTypeToRole, latestDocument, allowedNextStatuses, canTransitionListing } from "@/lib/transaction-helpers";

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

describe("pickDisplayDate", () => {
  it("labels a listing's expiration date 'Expires'", () => {
    expect(pickDisplayDate("listing", { expirationDate: "2026-02-22T00:00:00.000Z", closeOfEscrow: null })).toEqual({ label: "Expires", date: "2026-02-22T00:00:00.000Z" });
  });

  it("labels a transaction's close of escrow 'COE'", () => {
    expect(pickDisplayDate("transaction", { closeOfEscrow: "2026-03-01T00:00:00.000Z" })).toEqual({ label: "COE", date: "2026-03-01T00:00:00.000Z" });
  });

  it("never shows a listing's date as COE or a transaction's as Expires", () => {
    expect(pickDisplayDate("listing", { closeOfEscrow: "2026-03-01T00:00:00.000Z", expirationDate: null })).toBeNull();
    expect(pickDisplayDate("transaction", { expirationDate: "2026-02-22T00:00:00.000Z", closeOfEscrow: null })).toBeNull();
  });
});

describe("listing cancellation is broker-only", () => {
  it.each(["COMING_SOON", "ACTIVE", "ACTIVE_UNDER_CONTRACT"])("does not let an agent cancel a %s listing", (from) => {
    expect(canTransitionListing(from as any, "CANCELED", "AGENT")).toBe(false);
  });

  it.each(["INCOMPLETE", "COMING_SOON", "ACTIVE", "ACTIVE_UNDER_CONTRACT", "EXPIRED", "WITHDRAWN"])("still lets the broker cancel a %s listing", (from) => {
    expect(canTransitionListing(from as any, "CANCELED", "ADMIN")).toBe(true);
  });

  it("still lets an agent withdraw an active listing", () => {
    expect(canTransitionListing("ACTIVE", "WITHDRAWN", "AGENT")).toBe(true);
  });
});

describe("listingStatusOptions (agent)", () => {
  it("offers an Incomplete listing Coming Soon and Active", () => {
    expect(listingStatusOptions("INCOMPLETE", "AGENT")).toEqual(["COMING_SOON", "ACTIVE"]);
  });

  it("never offers Under Contract — converting is the only way there", () => {
    const options = listingStatusOptions("ACTIVE", "AGENT");
    expect(options).not.toContain("ACTIVE_UNDER_CONTRACT");
    expect(options).toEqual(expect.arrayContaining(["COMING_SOON", "EXPIRED", "WITHDRAWN"]));
  });

  it("never offers Cancel (broker only)", () => {
    for (const s of ["INCOMPLETE", "COMING_SOON", "ACTIVE", "EXPIRED"]) {
      expect(listingStatusOptions(s, "AGENT")).not.toContain("CANCELED");
    }
  });

  it("offers nothing while Under Contract — the linked transaction drives the listing", () => {
    expect(listingStatusOptions("ACTIVE_UNDER_CONTRACT", "AGENT")).toEqual([]);
  });

  it.each(["PENDING_TRANSFER", "WITHDRAWN", "CANCELED", "CLOSED"])("offers nothing for a %s listing", (s) => {
    expect(listingStatusOptions(s, "AGENT")).toEqual([]);
  });
});

describe("canDeleteListing", () => {
  it("allows an empty, never-converted listing", () => {
    expect(canDeleteListing({ documents: [], convertedFiles: [] })).toBe(true);
    expect(canDeleteListing({})).toBe(true);
  });

  it("refuses a listing with documents or a converted transaction", () => {
    expect(canDeleteListing({ documents: [{}], convertedFiles: [] })).toBe(false);
    expect(canDeleteListing({ documents: [], convertedFiles: [{}] })).toBe(false);
  });
});

describe("listingStatusOptions (broker)", () => {
  it("never offers Under Contract to the broker either — Convert is the only way there", () => {
    expect(listingStatusOptions("ACTIVE", "ADMIN")).not.toContain("ACTIVE_UNDER_CONTRACT");
    expect(listingStatusOptions("ACTIVE", "ADMIN")).toEqual(expect.arrayContaining(["CANCELED", "CLOSED", "WITHDRAWN"]));
  });

  it("keeps the broker's override while Under Contract", () => {
    expect(listingStatusOptions("ACTIVE_UNDER_CONTRACT", "ADMIN")).toEqual(expect.arrayContaining(["ACTIVE", "CLOSED", "WITHDRAWN", "CANCELED"]));
  });
});

describe("convertBlockedReason", () => {
  const item = (isRequired: boolean, statuses: string[]) => ({
    id: "c", name: "x", isRequired, documents: statuses.map((reviewStatus) => ({ reviewStatus: reviewStatus as any })),
  });

  it("allows an Active listing whose required items all have an upload (In Review or Approved)", () => {
    expect(convertBlockedReason({ status: "ACTIVE", checklistItems: [item(true, ["APPROVED"]), item(true, ["PENDING_REVIEW"]), item(false, [])] })).toBeNull();
  });

  it("blocks until every required listing document is uploaded (SkySlope's Accepted Contract rule)", () => {
    expect(convertBlockedReason({ status: "ACTIVE", checklistItems: [item(true, ["APPROVED"]), item(true, []), item(true, ["REJECTED"])] }))
      .toBe("Upload the 2 remaining required listing documents before converting");
  });

  it("uses the singular for one missing document", () => {
    expect(convertBlockedReason({ status: "ACTIVE", checklistItems: [item(true, [])] }))
      .toBe("Upload the 1 remaining required listing document before converting");
  });

  it("only converts an Active listing", () => {
    expect(convertBlockedReason({ status: "COMING_SOON", checklistItems: [] })).toBe("Only an Active listing can be converted");
  });
});

describe("sidePartiesReady (the wizard's rule: each side needs its own client)", () => {
  it.each([
    ["PURCHASE", true, false, true], ["PURCHASE", false, true, false],
    ["LISTING", false, true, true], ["LISTING", true, false, false],
    ["DUAL", true, false, false], ["DUAL", true, true, true],
    ["LEASE_TENANT", true, false, true], ["LEASE_LANDLORD", false, true, true],
    ["LEASE_DUAL", false, true, false], ["LEASE_DUAL", true, true, true],
  ] as const)("%s with buyer=%s seller=%s -> %s", (side, hasBuyer, hasSeller, expected) => {
    expect(sidePartiesReady(side, { hasBuyer, hasSeller })).toBe(expected);
  });
});

describe("isReadyForPending", () => {
  const seller = { role: "SELLER", name: "Sam Seller" };
  const buyer = { role: "BUYER", name: "Bea Buyer" };
  const sale = { transactionSide: "LISTING", salePrice: 900000, acceptanceDate: "2026-09-20", closeOfEscrow: "2026-10-20" };
  const lease = { transactionSide: "LEASE_TENANT", leasePrice: 36000, leaseSignedDate: "2026-09-20", leaseStartDate: "2026-10-01" };

  it("is ready when a sale has price, acceptance date, close of escrow and its client", () => {
    expect(isReadyForPending(sale, [seller])).toBe(true);
  });

  it.each(["salePrice", "acceptanceDate", "closeOfEscrow"])("is not ready without %s", (field) => {
    expect(isReadyForPending({ ...sale, [field]: null }, [seller])).toBe(false);
  });

  it("is not ready without the side's client (ignoring unnamed rows)", () => {
    expect(isReadyForPending(sale, [])).toBe(false);
    expect(isReadyForPending(sale, [{ role: "SELLER", name: "  " }])).toBe(false);
  });

  it("uses lease amount and lease dates for lease sides, not the sale fields", () => {
    expect(isReadyForPending(lease, [buyer])).toBe(true);
    expect(isReadyForPending({ ...lease, leaseStartDate: null }, [buyer])).toBe(false);
    expect(isReadyForPending({ ...lease, leasePrice: null, salePrice: 5 }, [buyer])).toBe(false);
  });

  it("never applies to referrals", () => {
    expect(isReadyForPending({ ...sale, transactionSide: "REFERRAL" }, [seller])).toBe(false);
  });
});

describe("transactionStatusOptions", () => {
  it("offers an agent Pre-Contract and Request Cancellation from Incomplete", () => {
    expect(transactionStatusOptions("INCOMPLETE", "AGENT")).toEqual(["PRE_CONTRACT", "CANCELED_PENDING"]);
  });

  it.each(["PRE_CONTRACT", "PENDING", "EXPIRED"])("offers an agent only Request Cancellation from %s", (s) => {
    expect(transactionStatusOptions(s, "AGENT")).toEqual(["CANCELED_PENDING"]);
  });

  it("never offers an agent Pending (it's automatic) or referral steps", () => {
    for (const s of ["INCOMPLETE", "PRE_CONTRACT", "PENDING", "EXPIRED"]) {
      const o = transactionStatusOptions(s, "AGENT");
      expect(o).not.toContain("PENDING");
      expect(o.some((x) => x.startsWith("REFERRAL_"))).toBe(false);
    }
  });

  it.each(["CANCELED_PENDING", "CANCELED_APPROVED", "CLOSED", "ARCHIVED", "PENDING_TRANSFER"])("offers an agent nothing from %s", (s) => {
    expect(transactionStatusOptions(s, "AGENT")).toEqual([]);
  });

  it("lets the server accept an agent's cancellation request from Incomplete and Expired", () => {
    expect(canTransitionTransaction("INCOMPLETE" as any, "CANCELED_PENDING" as any, "AGENT")).toBe(true);
    expect(canTransitionTransaction("EXPIRED" as any, "CANCELED_PENDING" as any, "AGENT")).toBe(true);
  });
});
