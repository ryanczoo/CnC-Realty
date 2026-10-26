// A pick-one card in the wizards (File Type, Listing Type, stage, category).
export function OptionCard({
  selected, onClick, label, desc, className = "",
}: {
  selected: boolean; onClick: () => void; label: string; desc?: string; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-6 text-center transition-colors ${selected ? "border-[#9E8C61] bg-[#9E8C61]/5" : "border-[#1B1B1B]/10 hover:border-[#1B1B1B]/25"} ${className}`}
    >
      <p className="font-semibold text-[#1B1B1B]">{label}</p>
      {desc && <p className="mt-1 text-xs text-[#1B1B1B]/40">{desc}</p>}
    </button>
  );
}
