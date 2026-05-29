"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { EASE_OUT_EXPO, SPRING_HOVER } from "@/lib/motion";

const STEPS = [
  {
    number: "01",
    title: "Apply",
    body: "Fill out an application and review the Independent Contractor Agreement.",
    image: "/images/join-house.jpg",
  },
  {
    number: "02",
    title: "Approval",
    body: "Get your guaranteed approval to join the team within 24 hours.",
    image: "/images/join-house.jpg",
  },
  {
    number: "03",
    title: "Onboarding",
    body: "A team member will welcome and prep you for your new journey.",
    image: "/images/join-house.jpg",
  },
  {
    number: "04",
    title: "Win",
    body: "Hit the ground running with full access to all our tools and network.",
    image: "/images/join-house.jpg",
  },
];

const EASE = EASE_OUT_EXPO as [number, number, number, number];

export function JoinStepsSlider() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [barWidths, setBarWidths] = useState([0, 0, 0, 0]);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const step = p < 0.25 ? 0 : p < 0.5 ? 1 : p < 0.75 ? 2 : 3;
    setActiveStep(step);
    setBarWidths(
      STEPS.map((_, i) => {
        const start = i * 0.25;
        const end = start + 0.25;
        if (p <= start) return 0;
        if (p >= end) return 100;
        return ((p - start) / 0.25) * 100;
      })
    );
  });

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="light"
      className="bg-[#F2F0EF]"
      style={{ height: "400vh" }}
    >
      {/* Sticky full-viewport container */}
      <div
        className="flex overflow-hidden"
        style={{ position: "sticky", top: 0, height: "100vh" }}
      >
        {/* Left — full-height image, crossfades on step change */}
        <div className="relative" style={{ width: "65%" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="absolute inset-0"
            >
              <Image
                src={STEPS[activeStep].image}
                alt={STEPS[activeStep].title}
                fill
                className="object-cover object-center"
                priority
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right — step content panel */}
        <div
          className="flex flex-col bg-[#F2F0EF]"
          style={{ width: "35%", padding: "3rem" }}
        >
          {/* Progress bars */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="flex-1 overflow-hidden"
                style={{ height: "2px", backgroundColor: "rgba(27,27,27,0.12)" }}
              >
                <div
                  className="h-full bg-[#1B1B1B]"
                  style={{
                    width: `${barWidths[i]}%`,
                    transition: "width 0.05s linear",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Step number + total counter */}
          <div className="mt-10 flex items-start justify-between">
            <AnimatePresence mode="wait">
              <motion.span
                key={`num-${activeStep}`}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="font-sans font-light leading-none text-[#1B1B1B]"
                style={{ fontSize: "clamp(5rem, 8vw, 9rem)" }}
              >
                {STEPS[activeStep].number}
              </motion.span>
            </AnimatePresence>
            <span
              className="font-sans text-sm text-[#1B1B1B]/30"
              style={{ paddingTop: "0.5rem" }}
            >
              / 04
            </span>
          </div>

          {/* Step title + body — animates on step change */}
          <div className="mb-12 mt-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={`content-${activeStep}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <h3
                  className="mb-4 font-sans font-light text-[#1B1B1B]"
                  style={{ fontSize: "clamp(1.4rem, 2vw, 2rem)" }}
                >
                  {STEPS[activeStep].title}
                </h3>
                <p
                  className="font-sans text-sm leading-relaxed text-[#1B1B1B]/45"
                  style={{ maxWidth: "28ch" }}
                >
                  {STEPS[activeStep].body}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Apply Now button — full-width border style matching aircenter */}
          <motion.div whileHover={{ scale: 1.03 }} transition={SPRING_HOVER}>
            <Link
              href="/join/agent"
              className="flex w-full items-center justify-between border border-[#1B1B1B]/15 px-6 py-4 font-sans transition-colors hover:border-[#1B1B1B]/40"
            >
              <span className="text-xs font-light uppercase tracking-widest text-[#1B1B1B]">
                Apply Now
              </span>
              <span className="text-lg font-light text-[#1B1B1B]">+</span>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
