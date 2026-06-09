"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import { fadeUp, PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

const STEPS = [
  {
    num: "01",
    title: "Talk to a Real Human.",
    body: "We match you with an expert who actually listens.",
  },
  {
    num: "02",
    title: "Get Clarity.",
    body: "We define what you really need, not just what's available.",
  },
  {
    num: "03",
    title: "Move Forward.",
    body: "We find what fits — and make it happen.",
  },
];

export function RentSteps() {
  return (
    <section className="bg-cnc-bg px-[75px] py-28">
      <div className="flex gap-10">

        {/* Left: heading + CTA */}
        <div className="flex flex-1 flex-col gap-8">
          <h2 className="font-sans font-light leading-[1.1]">
            <RevealLine className="block text-[1.9rem] xl:text-[2.2rem]">Moving made,</RevealLine>
            <span className="block pl-[7.5rem]">
              <RevealLine className="text-[3rem] xl:text-[3.5rem]" color="#9E8C61" delay={0.15}>Easy</RevealLine>
            </span>
          </h2>
          <motion.div
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            className="w-fit"
          >
            <Link
              href="/properties?listingType=FOR_RENT"
              className="flex items-center gap-2 rounded-full bg-cnc-dark px-7 py-4 font-sans text-base font-medium text-white"
            >
              Start Your Search <span aria-hidden>→</span>
            </Link>
          </motion.div>
        </div>

        {/* Right: steps list */}
        <div className="shrink-0 basis-[57%]">
          <p className="mb-6 font-sans text-2xl font-medium text-[#1B1B1B]">Steps:</p>
          <div>
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                {...fadeUp(i * 0.12)}
                className="flex items-center gap-10 border-t border-[#1B1B1B]/[0.07] py-6"
              >
                <span className="w-8 shrink-0 font-sans text-base font-medium tracking-widest text-cnc-gold">
                  {step.num}
                </span>
                <div className="font-sans font-medium leading-[1.15]">
                  <p className="text-[2.1rem] text-[#1B1B1B]">{step.title}</p>
                  <p className="text-[2.1rem] text-[#b3b3b3]">{step.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
