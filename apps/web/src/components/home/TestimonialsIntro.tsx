"use client";

import { AnimatePresence, motion } from "motion/react";
import { memo, useEffect, useState } from "react";
import { AdvantageCarousel } from "./AdvantageCarousel";

const WORDS = ["trust", "results", "futures", "homes", "teams"];

// Memoized so ghost words don't re-render on every word cycle
const GhostWords = memo(function GhostWords() {
  return (
    <>
      {WORDS.map((w) => (
        <span
          key={w}
          aria-hidden="true"
          style={{
            gridArea: "1/1",
            visibility: "hidden",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {w}
        </span>
      ))}
    </>
  );
});

export function TestimonialsIntro() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % WORDS.length), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <section data-navbar-theme="light" className="relative bg-[#F2F0EF]">
      {/* Sticky headline — stays fixed while the carousel below scrolls over it */}
      <div className="sticky top-[32vh] z-0 px-4 text-center">
        <h2
          className="font-sans font-light text-[#1B1B1B]"
          style={{ fontSize: "clamp(2.8rem, 5.5vw, 5rem)", lineHeight: 1.15 }}
        >
          We create{" "}
          {/*
            inline-grid trick: ghost spans all stack in the same grid cell to
            hold the width of the widest word — prevents "We create" from
            shifting as the cycling word changes length
          */}
          <span
            style={{
              display: "inline-grid",
              overflow: "visible",
              verticalAlign: "bottom",
              lineHeight: "inherit",
              fontSize: "clamp(3.5rem, 6.8vw, 6.2rem)",
            }}
          >
            <GhostWords />
            <AnimatePresence mode="wait">
              <motion.span
                key={idx}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0, transition: { duration: 0.9, ease: "easeOut" } }}
                exit={{ opacity: 0, transition: { duration: 0.25, ease: "easeIn" } }}
                style={{ gridArea: "1/1", display: "block", color: "#9E8C61" }}
              >
                {WORDS[idx]}
              </motion.span>
            </AnimatePresence>
          </span>
        </h2>
      </div>

      {/* Carousel — covers the sticky headline as the user scrolls (same mechanic Testimonials.tsx used to run with the review cards) */}
      <div className="relative z-10 mt-[52vh] bg-[#F2F0EF] pb-20">
        <AdvantageCarousel />
      </div>
    </section>
  );
}
