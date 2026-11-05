// Plain data shared by the file-review tests. No vi.fn or vi.mock in here, so it is safe to
// import from a test file that also uses vi.mock (hoisting only moves the vi.mock calls).

export const PENDING_ITEMS = [{ id: "i1", isRequired: true, documents: [{ id: "d1", reviewStatus: "PENDING_REVIEW" }] }];
export const APPROVED_ITEMS = [{ id: "i1", isRequired: true, documents: [{ id: "d1", reviewStatus: "APPROVED" }] }];

export const AGENT_SESSION = { user: { id: "u1", role: "AGENT", agentId: "a1" } } as any;

// A commission change an agent asked for after the broker approved the file.
export const REAL_PENDING = {
  before: { commissionPercent: 2.5, commissionAmount: null },
  changes: [{ label: "Commission", from: "2.5%", to: "2%" }],
  requestedAt: "2026-10-02T00:00:00.000Z",
};

// A transaction with everything it needs to move to Pending.
export const COMPLETE_TRANSACTION = {
  transactionSide: "LISTING",
  salePrice: 900000,
  acceptanceDate: new Date("2026-09-20"),
  closeOfEscrow: new Date("2026-10-20"),
  listingCommissionPct: 2.5,
  propertyType: "Condo",
  yearBuilt: 1990,
  parties: [{ role: "SELLER", name: "Sam" }],
};
