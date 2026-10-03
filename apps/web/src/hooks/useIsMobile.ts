import { useSyncExternalStore } from "react";

// The single phone/tablet cutoff for the whole site. Matches Tailwind's
// `max-lg:` variant, so CSS layout and JS animation values switch together.
export const MOBILE_QUERY = "(max-width: 1023px)";

export function createMobileStore(win: Pick<Window, "matchMedia">) {
  const mql = win.matchMedia(MOBILE_QUERY);
  return {
    subscribe(onChange: () => void) {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    getSnapshot: () => mql.matches,
  };
}

// Server HTML is always the desktop variant; during hydration React uses this
// value, then re-renders with the real one — no hydration mismatch.
export const getServerSnapshot = () => false as const;

let store: ReturnType<typeof createMobileStore> | null = null;
const getStore = () => (store ??= createMobileStore(window));
const subscribe = (onChange: () => void) => getStore().subscribe(onChange);
const getSnapshot = () => getStore().getSnapshot();

// For animation values only — layout changes belong in `max-lg:` CSS so the
// first paint is already correct.
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
