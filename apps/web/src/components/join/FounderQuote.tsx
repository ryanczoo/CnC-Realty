"use client";

import { useEffect, useRef, useState } from "react";

const WORDS =
  "CnC was created to fulfill a need in our modern-day era of real estate. A need to be in control of your own career. A need for full compensation and training to not only support but motivate real estate agents at any level to achieve their goals. With AI-integrated resources and a community built on providing the highest standard of service, CnC is a breath of fresh air for California."
    .split(" ");

export function FounderQuote() {
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [lit, setLit] = useState<boolean[]>(() => new Array(WORDS.length).fill(false));

  useEffect(() => {
    let threshold = window.innerHeight * 0.58;
    const onResize = () => { threshold = window.innerHeight * 0.58; };

    const onScroll = () => {
      setLit(
        wordRefs.current.map((el) =>
          el ? el.getBoundingClientRect().top < threshold : false
        )
      );
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <section className="bg-[#F2F0EF] px-8 py-28 lg:px-20">
      <div className="mx-auto max-w-5xl">

        {/* Attribution */}
        <div className="mb-12 flex items-center gap-4">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[#1B1B1B]/10">
            <img
              src="/images/ryan-chong.jpg"
              alt="Ryan Chong"
              className="h-full w-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div>
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-[#9E8C61]">Founder</p>
            <p className="font-sans text-sm font-medium text-[#1B1B1B]">Ryan Chong</p>
          </div>
        </div>

        {/* Quote */}
        <p className="font-sans text-[2rem] font-light leading-[1.25] sm:text-[2.5rem] lg:text-[3.25rem]">
          {WORDS.map((word, i) => (
            <span
              key={i}
              ref={(el) => { wordRefs.current[i] = el; }}
              className="transition-colors duration-300"
              style={{ color: lit[i] ? "#1B1B1B" : "#C4BFB8" }}
            >
              {word}
              {i < WORDS.length - 1 ? " " : ""}
            </span>
          ))}
        </p>

      </div>
    </section>
  );
}
