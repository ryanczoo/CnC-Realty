/**
 * Single source of truth for the placeholder values written when an approved agent
 * application seeds a locked `PENDING_TRANSFER` file, and for recognising / clearing
 * those values again once the signed transfer authorization is approved.
 *
 * Three separate places need to agree on these strings — the approval route that
 * writes them, the document-approve route that clears them on unlock, and the
 * locked-file panel that must not show a sentinel to the agent as if it were a real
 * saved address — so they live here rather than being re-typed at each site.
 */

/** Name of the single checklist item seeded onto a PENDING_TRANSFER placeholder file. */
export const TRANSFER_CHECKLIST_ITEM_NAME = "Upload Signed Transfer Authorization";

/** The full checklist item seeded onto a placeholder file. */
export const TRANSFER_CHECKLIST_ITEM = {
  name: TRANSFER_CHECKLIST_ITEM_NAME,
  description: null,
  order: 0,
  isRequired: true,
} as const;

/** Property-field sentinels written onto a placeholder ListingFile at creation time. */
export const LISTING_PLACEHOLDER = {
  propertyAddress: "Pending Transfer — Awaiting Signed Authorization",
  city: "Pending",
  zip: "00000",
  listPrice: 0,
  listingType: "RESIDENTIAL_SALE",
} as const;

/** True when `address` is the placeholder sentinel rather than a real address. */
export function isPlaceholderAddress(address: string | null | undefined): boolean {
  return address === LISTING_PLACEHOLDER.propertyAddress;
}

interface ListingSentinelFields {
  propertyAddress: string;
  city: string;
  zip: string;
}

/**
 * The property-field updates needed to return an unlocked listing file to the
 * "not yet filled in" state a freshly-created file has before the agent completes
 * their own Property step.
 *
 * Only fields that still hold their known sentinel are included, so an address the
 * agent already saved via the optional field on the locked panel is never clobbered.
 * `listPrice` is deliberately absent: its sentinel (`0`) is already exactly the
 * unfilled value, so there is nothing to clear.
 * `listingType` is likewise absent: it is a required enum with no "unset" member, so
 * it necessarily keeps its placeholder value.
 */
export function clearedListingSentinels(
  current: ListingSentinelFields
): Partial<ListingSentinelFields> {
  const cleared: Partial<ListingSentinelFields> = {};
  if (current.propertyAddress === LISTING_PLACEHOLDER.propertyAddress) cleared.propertyAddress = "";
  if (current.city === LISTING_PLACEHOLDER.city) cleared.city = "";
  if (current.zip === LISTING_PLACEHOLDER.zip) cleared.zip = "";
  return cleared;
}
