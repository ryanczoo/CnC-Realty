import { describe, it, expect, vi } from "vitest";
import { rafThrottle } from "@/lib/raf-throttle";

// A hand-cranked frame scheduler so the test controls when a "screen refresh" happens.
function fakeFrames() {
  let next = 1;
  const queue = new Map<number, () => void>();
  return {
    raf: (cb: () => void) => { const id = next++; queue.set(id, cb); return id; },
    caf: (id: number) => { queue.delete(id); },
    flush: () => { const cbs = Array.from(queue.values()); queue.clear(); cbs.forEach((cb) => cb()); },
    pending: () => queue.size,
  };
}

describe("rafThrottle", () => {
  it("runs once per frame no matter how many scroll events arrive", () => {
    const f = fakeFrames();
    const fn = vi.fn();
    const t = rafThrottle(fn, f.raf, f.caf);
    t.run(); t.run(); t.run();
    expect(fn).not.toHaveBeenCalled();
    f.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    t.run();
    f.flush();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("cancel drops a frame that hasn't run yet", () => {
    const f = fakeFrames();
    const fn = vi.fn();
    const t = rafThrottle(fn, f.raf, f.caf);
    t.run();
    t.cancel();
    expect(f.pending()).toBe(0);
    f.flush();
    expect(fn).not.toHaveBeenCalled();
  });
});
