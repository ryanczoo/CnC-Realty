// Phone-only (below 1024px) class bundles for the dashboard, appended to existing classes.
// Every word must start with `max-lg:` or `max-sm:` so nothing here can reach desktop — pinned by
// __tests__/lib/dashboard-phone.test.ts. Same idea as NAV_PANEL_CLS in lib/motion.ts.

// Centered popup overlay: centered, 16px from the screen edges.
export const PHONE_POPUP_FRAME = "max-lg:items-center max-lg:justify-center max-lg:p-4";
// Popup panel: never taller than the screen, scrolls inside, fully rounded.
export const PHONE_POPUP_PANEL =
  "max-lg:m-0 max-lg:max-h-[calc(100svh-2rem)] max-lg:overflow-y-auto max-lg:rounded-2xl";
// Side drawer panel: full width like the other drawers.
export const PHONE_DRAWER_PANEL = "max-lg:w-full";
// Table's parent card: scrolls the table sideways on phones; the table itself stays a real table (full card width).
export const PHONE_TABLE_FRAME = "max-lg:overflow-x-auto";
// Pill tab bar: scrolls sideways within itself; pills keep their size.
export const PHONE_TAB_BAR = "max-lg:max-w-full max-lg:overflow-x-auto max-lg:[&>*]:shrink-0";
// 16px fields so iPhone Safari doesn't zoom the page on focus.
export const PHONE_FIELDS_16 =
  "max-lg:[&_input]:text-base max-lg:[&_select]:text-base max-lg:[&_textarea]:text-base max-lg:[&_[contenteditable=true]]:text-base";
// Draggable cards: no iPhone text-selection popup on long-press; touch-friendly.
// -webkit-user-select is explicit: the build has no autoprefixer and iOS Safari ignores the unprefixed form.
export const PHONE_DRAG_CARD =
  "max-lg:select-none max-lg:[-webkit-user-select:none] max-lg:touch-manipulation max-lg:[-webkit-touch-callout:none]";
// Page header row (title left, actions right): stacks on phones — title full width, actions below.
export const PHONE_HEADER_STACK = "max-lg:flex-col max-lg:items-stretch";
// The header's actions group: one full-width row per action on phones (the status select sits
// inside a wrapper div, so it needs its own full-width word).
export const PHONE_HEADER_ACTIONS =
  "max-lg:w-full max-lg:flex-col max-lg:items-stretch max-lg:[&>*]:w-full max-lg:[&>*]:justify-center max-lg:[&>*]:text-center max-lg:[&_select]:w-full max-lg:[&>.group>button]:w-full";
// Two-column field pair in a wizard card: one field per row on narrow phones (below 640px).
export const PHONE_FIELD_PAIR = "max-sm:grid-cols-1";
// A line that is truncated with "…" on desktop wraps onto more lines on phones instead (long words break too).
export const PHONE_WRAP_TEXT = "max-lg:whitespace-normal max-lg:[overflow-wrap:anywhere]";
// The spot a card was picked up from (phone touch hold): a faded gold dashed outline, so you can see where it came from.
export const PHONE_DRAG_PLACEHOLDER = "max-lg:outline-dashed max-lg:outline-2 max-lg:outline-[#c9a84c]/60";
