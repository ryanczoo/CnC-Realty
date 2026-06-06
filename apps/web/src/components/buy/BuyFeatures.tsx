"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

const MotionLink = motion(Link);

const FEATURES = [
  "Local agents on standby",
  "Certified lenders for instant approval",
  "Award-winning Escrow officers",
];

function ShieldIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M15.5 9.5L11 14L9.5 12.5M12 3L20 7C20 12.1932 17.2157 19.5098 12 21C6.78428 19.5098 4 12.1932 4 7L8 5"
        stroke="#1B1B1B"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, ease: "easeOut", delay },
});

export function BuyFeatures() {
  return (
    <section className="bg-[#F2F0EF] px-8 py-20 lg:px-20">
      <div className="mx-auto max-w-6xl">
        {/* Staggered title — centered as a block, "SHOP" indented under "stop" */}
        <div className="mb-16 flex justify-center">
          <h2 className="font-sans font-light leading-[1.05]">
            <span className="block text-[2.4rem] xl:text-[2.9rem] text-[#1B1B1B]">
              <RevealLine delay={0}>One stop</RevealLine>
            </span>
            <span className="block text-[3.2rem] xl:text-[3.8rem] ml-[5rem] xl:ml-[6rem]">
              <RevealLine delay={0.15}>
                <span className="text-cnc-gold">SHOP</span>
              </RevealLine>
            </span>
          </h2>
        </div>

        {/* 4-column row */}
        <div className="grid grid-cols-4">
          {FEATURES.map((text, i) => (
            <motion.div
              key={i}
              {...fadeUp(i * 0.1)}
              className="flex flex-col gap-4 border-l border-[#1B1B1B]/15 px-8 py-6"
            >
              <ShieldIcon />
              <p className="font-sans text-[0.95rem] font-light leading-relaxed text-[#1B1B1B]/80">
                {text}
              </p>
            </motion.div>
          ))}

          {/* CTA column */}
          <motion.div
            {...fadeUp(0.3)}
            className="flex flex-col justify-end border-l border-[#1B1B1B]/15 px-8 pt-6 pb-2"
          >
            <div className="flex flex-col gap-2">
              <span className="font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">
                Explore
              </span>
              <MotionLink
                href="/properties"
                animate={PULSE_ANIMATE}
                whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
                transition={PULSE_TRANSITION}
                className="inline-flex w-fit items-center rounded-full bg-[#1B1B1B] px-6 py-3 font-sans text-sm font-medium text-white"
              >
                All Listings
              </MotionLink>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
