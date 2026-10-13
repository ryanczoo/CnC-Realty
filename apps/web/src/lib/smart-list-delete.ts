import { MOBILE_QUERY } from "@/hooks/useIsMobile";

// On phones the custom list's × is always visible inside a swipe row, so a stray tap
// could delete it — ask first, like every other delete in the app. Desktop (× only on
// hover) deletes right away, unchanged.
export function confirmListDelete(name: string, win: Pick<Window, "matchMedia" | "confirm"> = window): boolean {
  if (!win.matchMedia(MOBILE_QUERY).matches) return true;
  return win.confirm(`Delete the list "${name}"? This cannot be undone.`);
}
