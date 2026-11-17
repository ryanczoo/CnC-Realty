export const NEAR_ROOT_MARGIN = "800px 0px";
export const IDLE_FALLBACK_MS = 200;

export interface RevealState {
  loaded: boolean;
  idle: boolean;
  near: boolean;
}

/** The heavy chunk is requested only once the page has loaded, the browser is idle, and the spot is near the viewport. */
export function shouldRevealCalendar({ loaded, idle, near }: RevealState): boolean {
  return loaded && idle && near;
}

/** Without IntersectionObserver there is no way to know, so treat it as near. */
export function isNearViewport(hasObserver: boolean, intersecting: boolean): boolean {
  return hasObserver ? intersecting : true;
}
