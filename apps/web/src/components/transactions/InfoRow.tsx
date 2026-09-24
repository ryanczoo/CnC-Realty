// Shared label/value row used across the file-detail tabs — extracted so
// both OverviewTab and CommissionTab (and any consumer that renders either
// of them, agent-side or admin-side) get the exact same row styling.
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#1B1B1B]/5 pb-2 text-sm">
      <span className="text-[#1B1B1B]/50">{label}</span>
      <span className="text-right font-medium text-[#1B1B1B]">{value}</span>
    </div>
  );
}
