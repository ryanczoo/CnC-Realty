import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

// CSS-only tooltip: the wrapper is the hover target, so hovering anywhere on it
// (not just an icon) shows the popup above its left end. No JavaScript, no dependency.
export function Tooltip({ text, children, className, disabled = false }: Props) {
  return (
    <div className={cn("group relative", className)}>
      {children}
      {!disabled && (
        <span
          role="tooltip"
          className="pointer-events-none absolute -top-2 left-4 z-20 -translate-y-full whitespace-nowrap rounded-md bg-[#1B1B1B] px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {text}
        </span>
      )}
    </div>
  );
}
