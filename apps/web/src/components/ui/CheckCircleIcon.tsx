// Shared circled checkmark (Solar "Broken Lines" check-mark-circle) — the icon
// the Join page's Agent Plan list already used, now shared with the checklist's
// Approved status and the Approve button. currentColor, like TrashIcon.
export function CheckCircleIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20.94,11A8.26,8.26,0,0,1,21,12a9,9,0,1,1-9-9,8.83,8.83,0,0,1,4,1" />
      <polyline points="21 5 12 14 8 10" />
    </svg>
  );
}
