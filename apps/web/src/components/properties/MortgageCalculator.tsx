"use client";

import { useState } from "react";

interface Props {
  listPrice: number;
}

export function MortgageCalculator({ listPrice }: Props) {
  const [price, setPrice] = useState(listPrice);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(7);
  const [termYears, setTermYears] = useState<15 | 30>(30);

  const principal = price * (1 - downPct / 100);
  const monthlyRate = rate / 100 / 12;
  const n = termYears * 12;
  const monthly =
    monthlyRate === 0
      ? principal / n
      : (principal * (monthlyRate * Math.pow(1 + monthlyRate, n))) /
        (Math.pow(1 + monthlyRate, n) - 1);

  return (
    <div className="rounded-2xl bg-[#1a1a1a] p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/70">
        Mortgage Estimate
      </h3>

      <div className="mb-5 text-center">
        <p className="text-3xl font-bold text-white">
          ${Math.round(monthly).toLocaleString()}
          <span className="text-sm font-normal text-white/50">/mo</span>
        </p>
        <p className="mt-1 text-xs text-white/40">
          {downPct}% down · {rate}% APR · {termYears}-yr fixed
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/50">Purchase Price</span>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="rounded-lg bg-[#111] px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#9E8C61]/50"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/50">Down Payment: {downPct}%</span>
          <input
            type="range"
            min={3}
            max={50}
            value={downPct}
            onChange={(e) => setDownPct(Number(e.target.value))}
            className="accent-[#9E8C61]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/50">Interest Rate: {rate}%</span>
          <input
            type="range"
            min={3}
            max={12}
            step={0.25}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="accent-[#9E8C61]"
          />
        </label>

        <div className="flex gap-2">
          {([15, 30] as const).map((yr) => (
            <button
              key={yr}
              onClick={() => setTermYears(yr)}
              className={`flex-1 rounded-full py-1.5 text-sm transition-colors ${
                termYears === yr
                  ? "bg-[#9E8C61] text-white"
                  : "bg-[#111] text-white/50 hover:bg-[#222]"
              }`}
            >
              {yr}-yr
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[10px] text-white/20">
        Estimate only. Does not include taxes, insurance, or HOA.
      </p>
    </div>
  );
}
