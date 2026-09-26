// Shared upload icon (SVG Repo "upload-minimalistic") — the upload counterpart
// of DownloadIcon (same tray, arrow pointing up). currentColor, like TrashIcon.
export function UploadIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15 21H9C6.17157 21 4.75736 21 3.87868 20.1213C3 19.2426 3 17.8284 3 15M21 15C21 17.8284 21 19.2426 20.1213 20.1213C19.8215 20.4211 19.4594 20.6186 19 20.7487" />
      <path d="M12 16V3M12 3L16 7.375M12 3L8 7.375" />
    </svg>
  );
}
