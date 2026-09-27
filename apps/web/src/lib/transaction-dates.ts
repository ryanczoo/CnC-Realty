import { offerDateLabels } from "@/types/transaction";

// The one transaction date-order rule — the transaction counterpart of
// lib/listing-dates.ts, shared by the New Transaction wizard, POST
// /api/transactions and PATCH /api/transactions/[id]. Each pair is checked only
// when both dates are set and `input` touches at least one of them; each date
// comes from `input` when it's there, else from `saved` (so an Overview edit is
// checked against the stored date, and older data never blocks other edits).
// "YYYY-MM-DD" strings and stored Dates both parse to UTC midnight, so the
// comparison never slips a day. Returns an error message, or null if valid.

type DateValue = Date | string | null | undefined;
type DateKey = "acceptanceDate" | "closeOfEscrow" | "offerDate" | "offerExpirationDate" | "leaseSignedDate" | "leaseStartDate";
type Dates = Partial<Record<DateKey, DateValue>>;

export function transactionDatesError(
  input: Dates,
  saved: Dates = {},
  file: { side?: string | null; propertyCategory?: string | null } = {},
): string | null {
  const offer = offerDateLabels(file.side ?? null, file.propertyCategory ?? null) ?? { date: "Offer Date", expiration: "Offer Expiration Date" };
  const pairs: [DateKey, DateKey, string][] = [
    ["acceptanceDate", "closeOfEscrow", "Close of Escrow can't be before the Acceptance Date"],
    ["offerDate", "offerExpirationDate", `${offer.expiration} can't be before the ${offer.date}`],
    ["leaseSignedDate", "leaseStartDate", "Lease Start Date can't be before the Lease Signed Date"],
  ];
  const value = (k: DateKey) => (k in input ? input[k] : saved[k]);
  for (const [first, last, message] of pairs) {
    if (!(first in input) && !(last in input)) continue;
    const a = value(first);
    const b = value(last);
    if (a && b && new Date(b) < new Date(a)) return message;
  }
  return null;
}
