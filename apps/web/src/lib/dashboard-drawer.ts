// Where a dashboard side drawer sits: right edge, from just below the site's top bar (h-16) to the bottom.
// The root layout puts every page inside <main class="relative z-10">, so no z-index on a drawer can rise above
// the site's fixed top bar (z-50, outside that layer) — starting the drawer below the bar is what keeps its
// title and close button visible, on desktop and phones alike.
export const DRAWER_PANEL_POSITION = "right-0 top-16 bottom-0";
