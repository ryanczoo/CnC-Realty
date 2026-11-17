"use client";
import { useRef, useState } from "react";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { useClickOutside } from "@/hooks/useClickOutside";
import { NAV_PANEL_CLS, NAV_ITEM_CLS } from "@/lib/motion";
import { ROLE_OPTIONS } from "@/lib/role-options";

interface RoleSelectProps {
  value: string;
  onChange: (role: string) => void;
  error?: boolean;
  /** Called when the dropdown is toggled open/closed by the user (used to clear the error). */
  onOpen?: () => void;
}

// The "I am a" dropdown shared by the pop-up forms.
export function RoleSelect({ value, onChange, error = false, onOpen }: RoleSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div className="flex flex-col gap-1.5 max-lg:gap-1" ref={ref}>
      <label className={`font-sans text-sm text-left ${error ? "text-red-500" : "text-[#1B1B1B]/60"}`}>
        I am a<RequiredMark />
      </label>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); onOpen?.(); }}
        className="flex items-center justify-between border-b py-2 font-sans text-base transition-colors focus:outline-none max-lg:py-1.5"
        style={{ borderColor: error ? "rgb(239,68,68)" : open ? "rgba(27,27,27,0.6)" : "rgba(27,27,27,0.2)" }}
      >
        <span className={value ? "text-[#1B1B1B]" : "text-[#1B1B1B]/30"}>
          {value || "Select one…"}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#1B1B1B]/40" />
        </svg>
      </button>
      {open && (
        <div className="relative z-50">
          <div className={`absolute left-0 top-1 w-52 ${NAV_PANEL_CLS}`}>
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`${NAV_ITEM_CLS} ${value === opt ? "text-[#c9a84c]" : "text-white/80"}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
