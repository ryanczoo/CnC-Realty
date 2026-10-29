// A swipe row of pills (the Leads page's Smart Lists on phones): how far to scroll it so the chosen pill is on
// screen, 16px clear of the edge. Positions are on-screen rects; null when the pill is already fully visible.
const EDGE = 16;

export function pillScrollLeft(
  view: { left: number; width: number; scrollLeft: number },
  pill: { left: number; width: number },
): number | null {
  const rightLimit = view.left + view.width;
  if (pill.left < view.left) return view.scrollLeft + (pill.left - view.left - EDGE);
  if (pill.left + pill.width > rightLimit) return view.scrollLeft + (pill.left + pill.width - (rightLimit - EDGE));
  return null;
}
