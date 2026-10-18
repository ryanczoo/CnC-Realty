// Height to lay out a pinned (sticky, 100vh) scroll section against. Phones use the panel's
// own height, which stays put while the address bar slides; desktop keeps the window height.
export function pinnedPanelHeight(isMobile: boolean, panelPx: number, innerPx: number): number {
  return isMobile && panelPx > 0 ? panelPx : innerPx;
}
