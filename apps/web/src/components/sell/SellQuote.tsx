"use client";

import { useScrollWordLight } from "@/hooks/useScrollWordLight";
import { RevealLine } from "@/components/ui/reveal-text";

const WORDS =
  "We know a home is more than 4 walls - it's where memories are made and families are formed. So, when you trust us with one of the biggest decisions in life, we take it very seriously. With over 30+ years of expertise in California, our agents are prepared to handle your home like it's one of our own"
    .split(" ");

export function SellQuote() {
  const { sectionRef, litCount } = useScrollWordLight(WORDS.length);

  return (
    <section ref={sectionRef} data-navbar-theme="light" className="relative bg-cnc-bg px-8 py-16 lg:px-20">
      <div className="mb-10 flex justify-end">
        <h2 className="font-sans text-[2.5rem] font-light xl:text-[3rem]">
          <RevealLine>
            <span className="text-[1.9rem] xl:text-[2.2rem]">Our </span>
            <span className="text-cnc-gold font-medium">Promise</span>
          </RevealLine>
        </h2>
      </div>
      <p className="break-words text-center font-sans text-[1.9rem] font-light leading-[1.25] sm:text-[2.4rem] lg:text-[3rem]">
        {WORDS.map((word, i) => (
          <span
            key={i}
            className="transition-colors duration-300"
            style={{
              color:
                i < litCount
                  ? word === "very" ? "#9E8C61" : "#1B1B1B"
                  : "#C4BFB8",
            }}
          >
            {word}
            {i < WORDS.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
    </section>
  );
}
