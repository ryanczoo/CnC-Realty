export const SPRING_HOVER = { type: "spring", stiffness: 300, damping: 20 } as const;

// Shared class strings for the dark dropdown panel — matches the navbar menu panel.
// Used by Navbar.tsx and any page-level dropdowns so style stays in sync.
export const NAV_PANEL_CLS = "overflow-hidden rounded-xl border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur-md";
export const NAV_ITEM_CLS = "block w-full px-6 py-3 text-center text-sm font-medium transition-colors hover:bg-white/5 hover:text-[#c9a84c]";

export const EASE_OUT_EXPO: readonly [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_CSS = `cubic-bezier(${[0.16, 1, 0.3, 1].join(",")})`;

export function fadeUp(delay = 0, y = 40) {
  return {
    initial: { opacity: 0, y },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.9, ease: EASE_OUT_EXPO as [number, number, number, number], delay },
    viewport: { once: true, margin: "-8%" } as const,
  };
}

// Returns fill % (0–100) for each of n equal scroll segments given progress p.
export function computeSegmentProgress(p: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => {
    const start = i / n;
    const end = (i + 1) / n;
    if (p <= start) return 0;
    if (p >= end) return 100;
    return (p - start) * n * 100;
  });
}
