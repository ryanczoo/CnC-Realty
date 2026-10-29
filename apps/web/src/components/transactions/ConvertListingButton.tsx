"use client";
import { useState } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { ConvertListingModal } from "@/components/transactions/ConvertListingModal";

// The one Convert to Transaction button, used on the agent's and the broker's
// listing pages. blockedReason comes from convertBlockedReason (the same rule the
// convert route enforces): while set, the button is greyed out and hovering it
// explains what's missing. Clicking opens the representation pop-up.
export function ConvertListingButton({
  listingId,
  listingType,
  blockedReason,
  onConverted,
}: {
  listingId: string;
  listingType: string;
  blockedReason: string | null;
  onConverted: (transactionId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip text={blockedReason ?? ""} disabled={!blockedReason}>
        <button
          onClick={() => setOpen(true)}
          disabled={!!blockedReason}
          className="rounded-full border border-[#1B1B1B]/20 bg-white px-4 py-2 text-sm text-[#1B1B1B] hover:border-[#1B1B1B]/40 disabled:pointer-events-none disabled:opacity-40"
        >
          Convert to Transaction
        </button>
      </Tooltip>
      {open && (
        <ConvertListingModal
          listingId={listingId}
          listingType={listingType}
          onConverted={onConverted}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
