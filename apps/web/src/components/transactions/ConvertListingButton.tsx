"use client";
import { useState } from "react";
import { Tooltip } from "@/components/ui/Tooltip";

// The one Convert to Transaction button, used on the agent's and the broker's
// listing pages. blockedReason comes from convertBlockedReason (the same rule the
// convert route enforces): while set, the button is greyed out and hovering it
// explains what's missing.
export function ConvertListingButton({
  listingId,
  blockedReason,
  onConverted,
  onError,
}: {
  listingId: string;
  blockedReason: string | null;
  onConverted: (transactionId: string) => void;
  onError: (message: string) => void;
}) {
  const [converting, setConverting] = useState(false);

  async function convert() {
    setConverting(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/convert`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        onError(body?.error ?? "Couldn't convert this listing. Please try again.");
        return;
      }
      onConverted(body.transactionFile.id);
    } finally {
      setConverting(false);
    }
  }

  return (
    <Tooltip text={blockedReason ?? ""} disabled={!blockedReason}>
      <button
        onClick={convert}
        disabled={!!blockedReason || converting}
        className="rounded-full border border-[#1B1B1B]/20 bg-white px-4 py-2 text-sm text-[#1B1B1B] hover:border-[#1B1B1B]/40 disabled:pointer-events-none disabled:opacity-40"
      >
        {converting ? "Converting…" : "Convert to Transaction"}
      </button>
    </Tooltip>
  );
}
