import type { ReactNode } from "react";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { FieldError } from "@/components/ui/FieldError";

interface UnderlineFieldProps {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  error?: string | null;
  /** Extra classes on the wrapper (e.g. grid sizing). */
  className?: string;
}

const INPUT_CLS =
  "border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60 max-lg:py-1.5";
const TEXTAREA_CLS =
  "resize-none border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60 max-lg:h-14";

// A label sitting over a single-line (or multi-line) input with only an underline, used in the pop-up forms.
export function UnderlineField({
  label, required = true, type = "text", value, onChange, autoFocus, multiline, rows = 4, placeholder = "", error, className,
}: UnderlineFieldProps): ReactNode {
  return (
    <div className={className ?? "flex flex-col gap-1.5 max-lg:gap-1"}>
      <label className="font-sans text-sm text-left text-[#1B1B1B]/60">{label}{required && <RequiredMark />}</label>
      {multiline ? (
        <textarea
          rows={rows}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={TEXTAREA_CLS}
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          required={required}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_CLS}
          placeholder={placeholder}
        />
      )}
      <FieldError message={error} />
    </div>
  );
}
