// Shared trash-can icon used everywhere a "remove" action is offered across
// the dashboard (parties, checklist items, contingencies, etc.). Uses
// currentColor so it inherits whatever text color/hover state the parent
// button already sets, matching how lucide-react's Trash2 behaved before it
// was replaced by this custom icon sitewide.
export function TrashIcon({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M18 2.05222C19.3683 2.14165 20.2228 2.38425 20.7896 3.04233C21.6872 4.08466 21.4469 5.68646 20.9664 8.89004L19.7664 16.89C19.4008 19.3276 19.2179 20.5464 18.374 21.2732C17.5301 22 16.2976 22 13.8328 22H10.167C7.70216 22 6.46972 22 5.6258 21.2732C4.78187 20.5464 4.59905 19.3276 4.23341 16.89L3.03341 8.89004C2.55287 5.68645 2.3126 4.08466 3.21024 3.04233C4.10789 2 5.7276 2 8.96703 2H14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M21 6H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19 19H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M8 6L3.5 11L11 19M14 6L4 16M20 6L7 19M13 19L20.5 11L16 6M10 6L20 16M4 6L17 19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
