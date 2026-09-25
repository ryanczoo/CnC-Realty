// Shared plain checkmark — from SVG Repo's "unread" icon, stroked in
// currentColor (TrashIcon / DownloadIcon convention). For the circled version
// use CheckCircleIcon.
export function CheckIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7 12.9L10.1429 16.5L12.1071 14.25M18 7.5L14.0714 12" />
    </svg>
  );
}
