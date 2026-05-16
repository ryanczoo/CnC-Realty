export const SPRING_HOVER = { type: "spring", stiffness: 300, damping: 20 } as const;

export const EASE_OUT_EXPO: readonly [number, number, number, number] = [0.16, 1, 0.3, 1];

export function fadeUp(delay = 0, y = 40) {
  return {
    initial: { opacity: 0, y },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const, delay },
    viewport: { once: true, margin: "-8%" } as const,
  };
}
