"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "motion/react";
import Image from "next/image";
import { EASE_OUT_EXPO } from "@/lib/motion";

const STEPS = [
  {
    title: "Custom CRM",
    body: "Manage your leads, transactions, and campaigns all in one place with our AI-powered CRM built exclusively for CnC agents.",
    image: "/images/join-slide-crm.png",
  },
  {
    title: "Agent Profile",
    body: "Your own professional profile page with stats, listings, and a contact form — all live on cncrealtygroup.com the moment you join.",
    image: "/images/join-slide-agent.png",
  },
  {
    title: "Email Campaigns",
    body: "Send branded email campaigns and drip sequences to your leads directly from the CnC platform. No third-party tools needed.",
    image: "/images/join-slide-campaign.png",
  },
];

const EASE = EASE_OUT_EXPO as [number, number, number, number];

export function JoinStepsSlider() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [barWidths, setBarWidths] = useState([0, 0, 0]);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const step = p < 1 / 3 ? 0 : p < 2 / 3 ? 1 : 2;
    setActiveStep(step);
    setBarWidths(
      STEPS.map((_, i) => {
        const start = i / STEPS.length;
        const end = (i + 1) / STEPS.length;
        if (p <= start) return 0;
        if (p >= end) return 100;
        return ((p - start) / (1 / STEPS.length)) * 100;
      })
    );
  });

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="light"
      className="bg-white"
      style={{ height: "300vh" }}
    >
      {/* Sticky panel — inset 1.5rem from sides and bottom, below navbar */}
      <div
        className="flex gap-3 overflow-hidden"
        style={{
          position: "sticky",
          top: "5.5rem",
          height: "calc(100vh - 7.5rem)",
          margin: "0 1.5rem 1.5rem",
        }}
      >
        {/* Right — full-height image, crossfades on step change */}
        <div className="relative order-2 flex-1 -ml-6">
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
                className="object-contain object-center"
                priority
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right — step content panel */}
        <div
          className="order-1 flex h-full flex-col bg-[#DAD4D2]"
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

          {/* Step title + body — animates on step change */}
          <div className="flex flex-1 items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={`content-${activeStep}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <p
                  className="font-sans text-sm leading-relaxed text-[#1B1B1B]/45"
                  style={{ maxWidth: "42ch" }}
                >
                  {STEPS[activeStep].body}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </div>
    </section>
  );
}
