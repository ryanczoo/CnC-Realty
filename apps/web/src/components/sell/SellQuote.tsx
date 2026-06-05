"use client";

import { useEffect, useRef, useState } from "react";
import { RevealLine } from "@/components/ui/reveal-text";

const WORDS =
  "We know a home is more than 4 walls - it's where memories are made and families are formed. So, when you trust us with one of the biggest decisions in life, we take it very seriously. With over 30+ years of expertise in California, our agents are prepared to handle your home like it's one of our own."
    .split(" ");

export function SellQuote() {
  const sectionRef = useRef<HTMLElement>(null);
  const [litCount, setLitCount] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.max(0, Math.min(1, (vh - rect.top) / (vh * 1.0)));
      setLitCount(Math.round(progress * WORDS.length));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section ref={sectionRef} className="relative bg-cnc-bg px-8 py-16 lg:px-20">
      <div className="mb-10 flex justify-end">
        <h2 className="font-sans text-[2.5rem] font-light xl:text-[3rem]">
          <RevealLine>
            <span className="text-[1.9rem] xl:text-[2.2rem]">Our </span>
            <span style={{ color: "#9E8C61" }}>Promise</span>
          </RevealLine>
        </h2>
      </div>
      <p className="break-words text-center font-sans text-[2rem] font-light leading-[1.25] sm:text-[2.5rem] lg:text-[3.25rem]">
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
