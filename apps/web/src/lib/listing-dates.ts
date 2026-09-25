// The one List Date / Expiration Date rule, shared by the New Listing wizard,
// POST /api/listings, and PATCH /api/listings/[id]. Accepts the wizard's
// "YYYY-MM-DD" strings or stored Date values; both parse to UTC midnight, so
// comparing them never slips a day. Returns an error message, or null if valid.
export function listingDatesError(
  listDate: Date | string | null | undefined,
  expirationDate: Date | string | null | undefined,
): string | null {
  if (!listDate || !expirationDate) return "List date and expiration date are required";
  if (new Date(expirationDate) < new Date(listDate)) return "Expiration date can't be before the list date";
  return null;
}
