"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";

interface DateFieldProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  minYear?: number;
  maxYear?: number;
}

function parseIso(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? { year: m[1], month: m[2], day: m[3] } : { year: "", month: "", day: "" };
}

const segClass =
  "bg-transparent text-center text-sm text-[#1B1B1B] outline-none placeholder:text-[#1B1B1B]/40";

export function DateField({ value, onChange, minYear, maxYear }: DateFieldProps) {
  const initial = parseIso(value);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);
  const [year, setYear] = useState(initial.year);

  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = parseIso(value);
    setMonth(p.month);
    setDay(p.day);
    setYear(p.year);
  }, [value]);

  const emit = (m: string, d: string, y: string) => {
    onChange(m.length === 2 && d.length === 2 && y.length === 4 ? `${y}-${m}-${d}` : "");
  };

  const handleMonth = (raw: string) => {
    let v = raw.replace(/\D/g, "").slice(0, 2);
    if (v.length === 1 && Number(v) > 1) v = `0${v}`;
    if (v.length === 2) {
      v = String(Math.min(12, Math.max(1, Number(v)))).padStart(2, "0");
      dayRef.current?.focus();
      dayRef.current?.select();
    }
    setMonth(v);
    emit(v, day, year);
  };

  const handleDay = (raw: string) => {
    let v = raw.replace(/\D/g, "").slice(0, 2);
    if (v.length === 1 && Number(v) > 3) v = `0${v}`;
    if (v.length === 2) {
      v = String(Math.min(31, Math.max(1, Number(v)))).padStart(2, "0");
      yearRef.current?.focus();
      yearRef.current?.select();
    }
    setDay(v);
    emit(month, v, year);
  };

  const handleYear = (raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, 4);
    setYear(v);
    emit(month, day, v);
  };

  const clampYear = () => {
    if (year.length !== 4) return;
    const n = Number(year);
    const clamped =
      minYear !== undefined && n < minYear ? minYear :
      maxYear !== undefined && n > maxYear ? maxYear :
      null;
    if (clamped !== null) {
      const v = String(clamped);
      setYear(v);
      emit(month, day, v);
    }
  };

  const handleNativePick = (iso: string) => {
    const p = parseIso(iso);
    setMonth(p.month);
    setDay(p.day);
    setYear(p.year);
    onChange(iso);
  };

  return (
    <div className="flex w-full items-center gap-1 rounded-lg border border-[#1B1B1B]/10 bg-white px-4 py-3 focus-within:ring-2 focus-within:ring-[#9E8C61]/40">
      <input
        ref={monthRef}
        value={month}
        onChange={(e) => handleMonth(e.target.value)}
        placeholder="MM"
        inputMode="numeric"
        className={`${segClass} w-6`}
      />
      <span className="text-[#1B1B1B]/30">/</span>
      <input
        ref={dayRef}
        value={day}
        onChange={(e) => handleDay(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Backspace" && day === "") monthRef.current?.focus();
        }}
        placeholder="DD"
        inputMode="numeric"
        className={`${segClass} w-6`}
      />
      <span className="text-[#1B1B1B]/30">/</span>
      <input
        ref={yearRef}
        value={year}
        onChange={(e) => handleYear(e.target.value)}
        onBlur={clampYear}
        onKeyDown={(e) => {
          if (e.key === "Backspace" && year === "") dayRef.current?.focus();
        }}
        placeholder="YYYY"
        inputMode="numeric"
        className={`${segClass} w-12`}
      />
      <button
        type="button"
        onClick={() => {
          nativeRef.current?.showPicker?.();
          nativeRef.current?.click();
        }}
        aria-label="Open calendar"
        className="ml-auto text-[#1B1B1B]/40 transition-colors hover:text-[#9E8C61]"
      >
        <Calendar size={16} />
      </button>
      <input
        ref={nativeRef}
        type="date"
        value={value}
        min={minYear !== undefined ? `${minYear}-01-01` : undefined}
        max={maxYear !== undefined ? `${maxYear}-12-31` : undefined}
        onChange={(e) => handleNativePick(e.target.value)}
        className="h-0 w-0 border-0 p-0 opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
