"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";

interface DateFieldProps {
  value: string; // "YYYY-MM-DD" ("YYYY-MM-DDTHH:MM" when withTime) or ""
  onChange: (value: string) => void;
  minYear?: number;
  maxYear?: number;
  withTime?: boolean;
}

// ─── Date-only segment logic (unchanged behavior — withTime never touches these) ──

export function parseIso(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? { year: m[1], month: m[2], day: m[3] } : { year: "", month: "", day: "" };
}

export function clampMonthSegment(raw: string): string {
  let v = raw.replace(/\D/g, "").slice(0, 2);
  if (v.length === 1 && Number(v) > 1) v = `0${v}`;
  if (v.length === 2) v = String(Math.min(12, Math.max(1, Number(v)))).padStart(2, "0");
  return v;
}

export function clampDaySegment(raw: string): string {
  let v = raw.replace(/\D/g, "").slice(0, 2);
  if (v.length === 1 && Number(v) > 3) v = `0${v}`;
  if (v.length === 2) v = String(Math.min(31, Math.max(1, Number(v)))).padStart(2, "0");
  return v;
}

export function clampYearSegment(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

export function clampYearOnBlur(year: string, minYear?: number, maxYear?: number): string {
  if (year.length !== 4) return year;
  const n = Number(year);
  if (minYear !== undefined && n < minYear) return String(minYear);
  if (maxYear !== undefined && n > maxYear) return String(maxYear);
  return year;
}

export function buildDateValue(month: string, day: string, year: string): string {
  return month.length === 2 && day.length === 2 && year.length === 4 ? `${year}-${month}-${day}` : "";
}

// ─── Time segment logic (new, additive — only used when withTime is set) ──────────

export function clampHourSegment(raw: string): string {
  let v = raw.replace(/\D/g, "").slice(0, 2);
  if (v.length === 1 && Number(v) > 2) v = `0${v}`;
  if (v.length === 2) v = String(Math.min(23, Math.max(0, Number(v)))).padStart(2, "0");
  return v;
}

export function clampMinuteSegment(raw: string): string {
  let v = raw.replace(/\D/g, "").slice(0, 2);
  if (v.length === 1 && Number(v) > 5) v = `0${v}`;
  if (v.length === 2) v = String(Math.min(59, Math.max(0, Number(v)))).padStart(2, "0");
  return v;
}

export function buildDateTimeValue(month: string, day: string, year: string, hour: string, minute: string): string {
  return month.length === 2 && day.length === 2 && year.length === 4 && hour.length === 2 && minute.length === 2
    ? `${year}-${month}-${day}T${hour}:${minute}`
    : "";
}

export function parseDateTimeLocal(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return m
    ? { year: m[1], month: m[2], day: m[3], hour: m[4], minute: m[5] }
    : { year: "", month: "", day: "", hour: "", minute: "" };
}

const segClass =
  "bg-transparent text-center text-sm text-[#1B1B1B] outline-none placeholder:text-[#1B1B1B]/40";

export function DateField({ value, onChange, minYear, maxYear, withTime }: DateFieldProps) {
  const initial = withTime ? parseDateTimeLocal(value) : { ...parseIso(value), hour: "", minute: "" };
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);
  const [year, setYear] = useState(initial.year);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);

  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = withTime ? parseDateTimeLocal(value) : { ...parseIso(value), hour: "", minute: "" };
    setMonth(p.month);
    setDay(p.day);
    setYear(p.year);
    setHour(p.hour);
    setMinute(p.minute);
  }, [value, withTime]);

  const emit = (m: string, d: string, y: string, h: string, mi: string) => {
    onChange(withTime ? buildDateTimeValue(m, d, y, h, mi) : buildDateValue(m, d, y));
  };

  const handleMonth = (raw: string) => {
    const v = clampMonthSegment(raw);
    if (v.length === 2) { dayRef.current?.focus(); dayRef.current?.select(); }
    setMonth(v);
    emit(v, day, year, hour, minute);
  };

  const handleDay = (raw: string) => {
    const v = clampDaySegment(raw);
    if (v.length === 2) { yearRef.current?.focus(); yearRef.current?.select(); }
    setDay(v);
    emit(month, v, year, hour, minute);
  };

  const handleYear = (raw: string) => {
    const v = clampYearSegment(raw);
    if (v.length === 4 && withTime) { hourRef.current?.focus(); hourRef.current?.select(); }
    setYear(v);
    emit(month, day, v, hour, minute);
  };

  const handleHour = (raw: string) => {
    const v = clampHourSegment(raw);
    if (v.length === 2) { minuteRef.current?.focus(); minuteRef.current?.select(); }
    setHour(v);
    emit(month, day, year, v, minute);
  };

  const handleMinute = (raw: string) => {
    const v = clampMinuteSegment(raw);
    setMinute(v);
    emit(month, day, year, hour, v);
  };

  const handleYearBlur = () => {
    const v = clampYearOnBlur(year, minYear, maxYear);
    if (v !== year) {
      setYear(v);
      emit(month, day, v, hour, minute);
    }
  };

  const handleNativePick = (raw: string) => {
    const p = withTime ? parseDateTimeLocal(raw) : { ...parseIso(raw), hour: "", minute: "" };
    setMonth(p.month);
    setDay(p.day);
    setYear(p.year);
    setHour(p.hour);
    setMinute(p.minute);
    onChange(raw);
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
        onBlur={handleYearBlur}
        onKeyDown={(e) => {
          if (e.key === "Backspace" && year === "") dayRef.current?.focus();
        }}
        placeholder="YYYY"
        inputMode="numeric"
        className={`${segClass} w-12`}
      />
      {withTime && (
        <>
          <span className="ml-1 text-[#1B1B1B]/30">at</span>
          <input
            ref={hourRef}
            value={hour}
            onChange={(e) => handleHour(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && hour === "") yearRef.current?.focus();
            }}
            placeholder="HH"
            inputMode="numeric"
            className={`${segClass} w-6`}
          />
          <span className="text-[#1B1B1B]/30">:</span>
          <input
            ref={minuteRef}
            value={minute}
            onChange={(e) => handleMinute(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && minute === "") hourRef.current?.focus();
            }}
            placeholder="MM"
            inputMode="numeric"
            className={`${segClass} w-6`}
          />
        </>
      )}
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
        type={withTime ? "datetime-local" : "date"}
        value={value}
        min={!withTime && minYear !== undefined ? `${minYear}-01-01` : undefined}
        max={!withTime && maxYear !== undefined ? `${maxYear}-12-31` : undefined}
        onChange={(e) => handleNativePick(e.target.value)}
        className="h-0 w-0 border-0 p-0 opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
