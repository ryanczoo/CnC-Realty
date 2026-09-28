// The required-field asterisk — every one on the site renders through this, so
// its color lives in exactly one place. Hidden from screen readers: the field
// itself carries the "required" meaning.
export function RequiredMark({ className = "ml-1" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`${className} text-[#A42A04]`}>
      *
    </span>
  );
}
