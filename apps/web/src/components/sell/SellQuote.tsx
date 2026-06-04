"use client";

import { useEffect, useRef, useState } from "react";

const WORDS =
  "CnC was created to fulfill a need in our modern-day era of real estate. A need to be in control of your own career. A need for full compensation and training to not only support but motivate real estate agents at any level to achieve their goals. With AI-integrated resources and a community built on providing the highest standard of service, CnC is a breath of fresh air for California."
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
    <section ref={sectionRef} className="bg-cnc-bg px-8 py-16 lg:px-20">
      <p className="break-words text-center font-sans text-[2rem] font-light leading-[1.25] sm:text-[2.5rem] lg:text-[3.25rem]">
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
    </section>
  );
}
