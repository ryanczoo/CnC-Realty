"use client";

import { useEffect, useRef, useState } from "react";
import { RevealLine } from "@/components/ui/reveal-text";

const WORDS =
  "The rental market never slows down - and neither do we. From tenant placement to monthly reporting, our team of dedicated agents and assistants handle everything to give you peace of mind"
    .split(" ");

export function ManageQuote() {
  const sectionRef = useRef<HTMLElement>(null);
  const [litCount, setLitCount] = useState(0);
  const lastCountRef = useRef(-1);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let sectionTop = section.offsetTop;
    let vh = window.innerHeight;

    const compute = () => {
      const next = Math.round(Math.max(0, Math.min(1, (window.scrollY + vh - sectionTop) / vh)) * WORDS.length);
      if (next === lastCountRef.current) return;
      lastCountRef.current = next;
      setLitCount(next);
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
    <section ref={sectionRef} data-navbar-theme="light" className="relative bg-cnc-bg px-8 py-16 lg:px-20">
      <h2 className="mb-10 font-sans font-light leading-[1.1]">
        <RevealLine className="block text-[1.9rem] xl:text-[2.2rem]">Your property,</RevealLine>
        <span className="block pl-[4.8rem]">
          <RevealLine className="text-[3rem] xl:text-[3.5rem] font-medium" color="#9E8C61" delay={0.15}>Managed</RevealLine>
        </span>
      </h2>
      <p className="break-words text-center font-sans text-[1.9rem] font-light leading-[1.25] sm:text-[2.4rem] lg:text-[3rem]">
        {WORDS.map((word, i) => (
          <span
            key={i}
            className="transition-colors duration-300"
            style={{
              color: i < litCount ? (word === "dedicated" ? "#9E8C61" : "#1B1B1B") : "#C4BFB8",
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
