import { useEffect, useState, type RefObject } from "react";
import { IDLE_FALLBACK_MS, NEAR_ROOT_MARGIN, isNearViewport, shouldRevealCalendar } from "@/lib/deferred-reveal";

/** True once the page has loaded, the browser is idle, and `ref` is within ~800px of the viewport. Never goes back to false. */
export function useDeferredReveal(ref: RefObject<Element | null>): boolean {
  const [loaded, setLoaded] = useState(false);
  const [idle, setIdle] = useState(false);
  const [near, setNear] = useState(false);

  // Page load, then idle.
  useEffect(() => {
    let cancelled = false;
    let idleHandle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const afterLoad = () => {
      if (cancelled) return;
      setLoaded(true);
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(() => !cancelled && setIdle(true));
      } else {
        timer = setTimeout(() => !cancelled && setIdle(true), IDLE_FALLBACK_MS);
      }
    };

    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", afterLoad);
      if (idleHandle !== undefined && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleHandle);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  // Nearness.
  useEffect(() => {
    const el = ref.current;
    const hasObserver = typeof IntersectionObserver === "function";
    if (!el || !hasObserver) {
      setNear(isNearViewport(false, false));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(isNearViewport(true, true));
      },
      { rootMargin: NEAR_ROOT_MARGIN },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  return shouldRevealCalendar({ loaded, idle, near });
}
