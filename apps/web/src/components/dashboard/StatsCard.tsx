interface StatsCardProps {
  label: string;
  value: number | string;
  sub?: string;
}

export function StatsCard({ label, value, sub }: StatsCardProps) {
  return (
    <div className="rounded-2xl bg-white p-6">
      <p className="font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">{label}</p>
      <p className="mt-2 font-sans text-4xl font-light text-[#1B1B1B]">{value}</p>
      {sub && <p className="mt-1 font-sans text-sm text-[#1B1B1B]/40">{sub}</p>}
    </div>
  );
}
