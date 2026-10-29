import { SIDES } from "@/types/transaction";
import { convertSideChoices } from "@/lib/representation";

// The two cards in the Convert pop-up: the representation choices for this listing
// type, worded exactly like the New Transaction wizard (labels/descs from SIDES).
export function convertChoiceCards(listingType: string): { value: string; label: string; desc: string }[] {
  return convertSideChoices(listingType).map((value) => {
    const side = SIDES.find((s) => s.value === value)!;
    return { value: side.value, label: side.label, desc: side.desc };
  });
}
