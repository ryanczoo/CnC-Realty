"use client";

import { useEffect, useRef, useState } from "react";

const WORDS =
  "CnC was created to fulfill a need in our modern-day era of real estate. A need to be in control of your own career. A need for full compensation and training to not only support but motivate real estate agents at any level to achieve their goals. With AI-integrated resources and a community built on providing the highest standard of service, CnC is a breath of fresh air for California."
    .split(" ");

export function FounderQuote() {
  const sectionRef = useRef<HTMLElement>(null);
  const [litCount, setLitCount] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    // Cache offsetTop once; update on resize to avoid reflow on every scroll tick
    let sectionTop = section.offsetTop;
    let vh = window.innerHeight;

    // 0 when section enters viewport bottom, 1 when section exits viewport top
    const compute = () => {
      const progress = Math.max(0, Math.min(1, (window.scrollY + vh - sectionTop) / vh));
      setLitCount(Math.round(progress * WORDS.length));
    };

    const onResize = () => { sectionTop = section.offsetTop; vh = window.innerHeight; compute(); };
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", compute, { passive: true });
    compute();
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", onResize);
    };
  }, []);

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
        <p className="break-words font-sans text-[2rem] font-light leading-[1.25] sm:text-[2.5rem] lg:text-[3.25rem]">
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
