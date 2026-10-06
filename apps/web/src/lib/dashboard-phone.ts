// Phone-only (below 1024px) class bundles for the dashboard, appended to existing classes.
// Every word must start with `max-lg:` so nothing here can reach desktop — pinned by
// __tests__/lib/dashboard-phone.test.ts. Same idea as NAV_PANEL_CLS in lib/motion.ts.

// Centered popup overlay: centered, 16px from the screen edges.
export const PHONE_POPUP_FRAME = "max-lg:items-center max-lg:justify-center max-lg:p-4";
// Popup panel: never taller than the screen, scrolls inside, fully rounded.
export const PHONE_POPUP_PANEL =
  "max-lg:m-0 max-lg:max-h-[calc(100svh-2rem)] max-lg:overflow-y-auto max-lg:rounded-2xl";
// Side drawer panel: full width like the other drawers.
export const PHONE_DRAWER_PANEL = "max-lg:w-full";
// Table: scrolls sideways inside its own box (no wrapper element needed).
export const PHONE_TABLE = "max-lg:block max-lg:overflow-x-auto";
// Pill tab bar: scrolls sideways within itself; pills keep their size.
export const PHONE_TAB_BAR = "max-lg:max-w-full max-lg:overflow-x-auto max-lg:[&>*]:shrink-0";
// 16px fields so iPhone Safari doesn't zoom the page on focus.
export const PHONE_FIELDS_16 =
  "max-lg:[&_input]:text-base max-lg:[&_select]:text-base max-lg:[&_textarea]:text-base max-lg:[&_[contenteditable=true]]:text-base";
// Draggable cards: no iPhone text-selection popup on long-press; touch-friendly.
export const PHONE_DRAG_CARD = "max-lg:select-none max-lg:touch-manipulation max-lg:[-webkit-touch-callout:none]";
