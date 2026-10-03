import { describe, it, expect, vi } from "vitest";
import { MOBILE_QUERY, createMobileStore, getServerSnapshot } from "@/hooks/useIsMobile";

function fakeWindow(initial: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: initial,
    addEventListener: vi.fn((_: string, cb: () => void) => listeners.add(cb)),
    removeEventListener: vi.fn((_: string, cb: () => void) => listeners.delete(cb)),
  };
  const win = { matchMedia: vi.fn(() => mql) } as unknown as Pick<Window, "matchMedia">;
  const flip = (next: boolean) => {
    mql.matches = next;
    listeners.forEach((cb) => cb());
  };
  return { win, mql, flip, listeners };
}

describe("useIsMobile store", () => {
  it("uses the shared 1024px cutoff", () => {
    expect(MOBILE_QUERY).toBe("(max-width: 1023px)");
    const { win } = fakeWindow(false);
    createMobileStore(win);
    expect(win.matchMedia).toHaveBeenCalledWith("(max-width: 1023px)");
  });

  it("reports the current match", () => {
    expect(createMobileStore(fakeWindow(true).win).getSnapshot()).toBe(true);
    expect(createMobileStore(fakeWindow(false).win).getSnapshot()).toBe(false);
  });

  it("notifies subscribers when the screen crosses the cutoff (e.g. iPad rotation)", () => {
    const { win, flip } = fakeWindow(true);
    const store = createMobileStore(win);
    const onChange = vi.fn();
    store.subscribe(onChange);
    flip(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(false);
  });

  it("removes its listener on unsubscribe", () => {
    const { win, flip, listeners } = fakeWindow(false);
    const store = createMobileStore(win);
    const onChange = vi.fn();
    const unsubscribe = store.subscribe(onChange);
    unsubscribe();
    expect(listeners.size).toBe(0);
    flip(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is never mobile on the server, so server HTML always matches desktop", () => {
    expect(getServerSnapshot()).toBe(false);
  });
});
