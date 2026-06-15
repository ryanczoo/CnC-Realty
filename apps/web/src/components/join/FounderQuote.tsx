"use client";

import { useScrollWordLight } from "@/hooks/useScrollWordLight";

const WORDS =
  "CnC was created to fulfill a need in our modern-day era of real estate. A need to be in control of your own career. A need for full compensation and training to not only support but motivate real estate agents at any level to achieve their goals. With AI-integrated resources and a community built on providing the highest standard of service, CnC is a breath of fresh air for California."
    .split(" ");

export function FounderQuote() {
  const { sectionRef, litCount } = useScrollWordLight(WORDS.length);

  return (
    <section ref={sectionRef} className="bg-cnc-bg px-8 py-16 lg:px-20">
      <div className="overflow-hidden">

        {/* Floated left: photo then labels below */}
        <div className="float-left mr-10 mb-4">
          <img
            src="/images/ryan-chong.png"
            alt="Ryan Chong"
            className="h-32 w-auto object-contain object-top"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <p className="mt-2 font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-[#9E8C61]">Founder</p>
          <p className="font-sans text-sm font-medium text-[#1B1B1B]">Ryan Chong</p>
        </div>

        {/* Quote flows right of photo then wraps under */}
        <p className="break-words font-sans text-[1.9rem] font-light leading-[1.25] sm:text-[2.4rem] lg:text-[3rem]">
          {WORDS.map((word, i) => (
            <span
              key={i}
              className="transition-colors duration-300"
              style={{
                color: i < litCount
                  ? (word === "need" ? "#9E8C61" : "#1B1B1B")
                  : "#C4BFB8",
              }}
            >
              {word}
              {i < WORDS.length - 1 ? " " : ""}
            </span>
          ))}
        </p>

      </div>
    </section>
  );
}
