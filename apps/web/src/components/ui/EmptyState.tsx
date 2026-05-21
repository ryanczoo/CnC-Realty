export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1B1B1B]/20 py-16 text-center">
      <p className="text-[#1B1B1B]/40">{message}</p>
    </div>
  );
}
