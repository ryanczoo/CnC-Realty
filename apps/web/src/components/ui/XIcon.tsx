// Shared plain X — Ryan's design, drawn to match CheckIcon's broken-line style:
// two diagonals with one gap on the bottom-left→top-right line, halfway between
// the center and the top-right end. currentColor, like CheckIcon / TrashIcon.
export function XIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7 7L17 17 M7 17L13.44 10.56 M15.56 8.44L17 7" />
    </svg>
  );
}
