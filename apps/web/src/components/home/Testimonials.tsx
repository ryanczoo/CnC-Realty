"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { memo, useEffect, useState } from "react";
import { fadeUp } from "@/lib/motion";

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

export function Testimonials() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % WORDS.length), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <section data-navbar-theme="light" className="relative bg-[#F2F0EF]">

      {/* Sticky headline — stays fixed while content scrolls over it */}
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

      {/* 3-column content — bg covers sticky headline as user scrolls */}
      {/* Staggered layout: all 6 boxes same fixed height, side columns offset downward */}
      <div
        className="relative z-10 mt-[52vh]"
        style={{ display: "flex", gap: "1px", backgroundColor: "#F2F0EF", alignItems: "flex-start" }}
      >
        {/* Left column — offset down by 200px */}
        <div className="flex flex-1 flex-col" style={{ marginTop: "200px", gap: "1px" }}>
          <motion.div {...fadeUp(0)} style={{ height: "420px", overflow: "hidden", position: "relative" }}>
            <Image src="/images/testimonials-left.jpg" alt="" fill className="object-cover" />
          </motion.div>
          <motion.div
            {...fadeUp(0.06)}
            className="flex flex-col bg-white px-10 py-10"
            style={{ height: "420px" }}
          >
            <p className="font-sans text-[1.05rem] leading-[1.85] text-[#1B1B1B]">
              Working with CnC Realty has been an inspiring experience. Their deep
              knowledge of the real estate sector, combined with a dynamic and
              dedicated team, authentically guided us through every step and
              amplified our confidence throughout the entire process.
            </p>
            <p className="mt-4 font-sans text-[1.05rem] leading-[1.85] text-[#1B1B1B]">
              A partnership we truly value and look forward to continuing.
            </p>
            <div className="mt-auto border-t border-[#1B1B1B]/15 pt-5">
              <p className="font-sans text-sm font-medium text-[#1B1B1B]">Kevin Luevanos</p>
              <p className="font-sans text-xs text-[#1B1B1B]/45">Prime Construction LLC</p>
            </div>
          </motion.div>
        </div>

        {/* Center column — starts at top */}
        <div className="flex flex-1 flex-col" style={{ gap: "1px" }}>
          <motion.div
            {...fadeUp(0.08)}
            className="flex flex-col bg-[#1B1B1B] px-10 py-10"
            style={{ height: "420px" }}
          >
            <p className="font-sans text-[1.05rem] leading-[1.85] text-white">
              Last year when my husband and I bought our home, we had no idea where
              to start! CnC really made the homebuying process easy and we couldn&apos;t
              be happier with our purchase. Highly recommend reaching out to get some
              helpful insight before making the first step.
            </p>
            <div className="mt-auto border-t border-white/15 pt-5">
              <p className="font-sans text-sm font-medium text-white">Jessica Meyes</p>
              <p className="font-sans text-xs text-white/40">First Time Homeowner</p>
            </div>
          </motion.div>
          <motion.div {...fadeUp(0.12)} style={{ height: "420px", overflow: "hidden", position: "relative" }}>
            <Image src="/images/testimonials-center.jpg" alt="" fill className="object-cover" />
          </motion.div>
          <motion.div
            {...fadeUp(0.16)}
            className="flex flex-col bg-[#1B1B1B] px-10 py-10"
            style={{ height: "420px" }}
          >
            <p className="font-sans text-[1.05rem] leading-[1.85] text-white">
              Much appreciation for the folks over at CnC — not only did I get top
              dollar for my home, but I moved into a bigger home with a 1031 exchange.
              If you want the best communication, knowledge, and professionalism, you
              have to give CnC a call.
            </p>
            <div className="mt-auto border-t border-white/15 pt-5">
              <p className="font-sans text-sm font-medium text-white">Raymond Lee</p>
              <p className="font-sans text-xs text-white/40">SoCal Resident & Investor</p>
            </div>
          </motion.div>
        </div>

        {/* Right column — offset down by 200px */}
        <div className="flex flex-1 flex-col" style={{ marginTop: "200px", gap: "1px" }}>
          <motion.div {...fadeUp(0.04)} style={{ height: "420px", overflow: "hidden", position: "relative" }}>
            <Image src="/images/testimonials-right.jpg" alt="" fill className="object-cover" />
          </motion.div>
          <motion.div
            {...fadeUp(0.10)}
            className="flex flex-col bg-white px-10 py-10"
            style={{ height: "420px" }}
          >
            <p className="font-sans text-[1.05rem] leading-[1.85] text-[#1B1B1B]">
              My experience switching from my previous brokerage to CnC has exceeded
              my expectations. Being able to take home ALL of my commission has really
              changed the game for me. I am able to commit more time to client outreach
              and less time balancing my day-job.
            </p>
            <div className="mt-auto border-t border-[#1B1B1B]/15 pt-5">
              <p className="font-sans text-sm font-medium text-[#1B1B1B]">Rachel Kent</p>
              <p className="font-sans text-xs text-[#1B1B1B]/45">Real Estate Agent</p>
            </div>
          </motion.div>
        </div>

      </div>

    </section>
  );
}
