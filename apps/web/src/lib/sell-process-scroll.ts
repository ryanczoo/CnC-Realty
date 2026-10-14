// Phone math for Sell's "Our Process" pinned scroll (below 1024px). Desktop uses its own vw values in SellProcess.
// How far the row slides: its right edge ends at the screen's right edge.
export function phoneTravelPx(rowWidth: number, viewportWidth: number): number {
  return Math.max(0, Math.round(rowWidth - viewportWidth));
}

// Section height on phones: the slide distance plus one screen, so scrolling moves the cards about one-for-one.
// Before the row is measured, a safe fallback that still pins the section.
export function phoneSectionHeight(travelPx: number | null): string {
  return travelPx === null ? "600svh" : `calc(${travelPx}px + 100svh)`;
}
