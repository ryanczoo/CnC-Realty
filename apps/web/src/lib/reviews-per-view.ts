// Reviews shown side by side: 3 on desktop (unchanged), 2 on wider phones and
// iPads, 1 on upright phones — three columns at 390px wrap one word per line.
export function reviewsPerView(viewportWidth: number): number {
  if (viewportWidth >= 1024) return 3;
  if (viewportWidth >= 640) return 2;
  return 1;
}
