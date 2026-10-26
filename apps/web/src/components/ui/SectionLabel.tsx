// The small grey uppercase heading over a group of wizard choices.
export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`mb-4 text-xs font-semibold uppercase tracking-widest text-[#1B1B1B]/40 ${className}`}>{children}</p>
  );
}
