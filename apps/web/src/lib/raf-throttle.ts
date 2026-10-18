// Collapse a burst of scroll/resize events into at most one call per screen refresh.
export function rafThrottle(
  fn: () => void,
  raf: (cb: () => void) => number = (cb) => requestAnimationFrame(cb),
  caf: (id: number) => void = (id) => cancelAnimationFrame(id),
) {
  let id: number | null = null;
  return {
    run() {
      if (id !== null) return;
      id = raf(() => { id = null; fn(); });
    },
    cancel() {
      if (id !== null) caf(id);
      id = null;
    },
  };
}
