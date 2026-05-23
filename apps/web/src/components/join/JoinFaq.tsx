"use client";
import { useState } from "react";

interface Faq {
  q: string;
  a: string;
}

export function JoinFaq({ faqs }: { faqs: Faq[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="divide-y divide-white/10">
      {faqs.map((faq, i) => (
        <div key={faq.q}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-8 py-6 text-left"
          >
            <span className="font-sans text-base font-medium text-white">{faq.q}</span>
            <span
              className="shrink-0 text-xl font-light text-[#9E8C61] transition-transform duration-300"
              style={{ transform: open === i ? "rotate(45deg)" : "rotate(0deg)" }}
            >
              +
            </span>
          </button>
          <div
            className="overflow-hidden transition-all duration-300"
            style={{ maxHeight: open === i ? "200px" : "0px" }}
          >
            <p className="pb-6 font-sans text-sm font-light leading-relaxed text-white/50">{faq.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
