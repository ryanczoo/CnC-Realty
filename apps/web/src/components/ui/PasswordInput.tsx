"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface Props {
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  minLength?: number;
  className?: string;
}

const baseClass =
  "w-full rounded-md border border-[#1B1B1B]/20 bg-white px-3 py-2.5 text-sm text-[#1B1B1B] placeholder:text-[#1B1B1B]/40 focus:outline-none focus:ring-2 focus:ring-[#9E8C61]";

export function PasswordInput({ placeholder, value, onChange, minLength, className }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        required
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        minLength={minLength}
        className={`${baseClass} pr-10 ${className ?? ""}`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1B1B1B]/40 hover:text-[#1B1B1B]/70"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export { baseClass as inputClass };
