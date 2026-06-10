export type SlidePosition = "active" | "prev" | "next" | "hidden";

export function getSlideState(
  idx: number,
  activeIdx: number,
  total: number
): SlidePosition {
  if (idx === activeIdx) return "active";
  if (idx === (activeIdx - 1 + total) % total) return "prev";
  if (idx === (activeIdx + 1) % total) return "next";
  return "hidden";
}
