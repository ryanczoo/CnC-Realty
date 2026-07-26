"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER, STACK_SPRING } from "@/lib/motion";

export type StackDepth = "front" | "middle" | "back";

export function getStackDepth(idx: number, activeIdx: number, total: number): StackDepth {
  const offset = (idx - activeIdx + total) % total;
  if (offset === 0) return "front";
  if (offset === 1) return "middle";
  return "back";
}

function stackAnimate(depth: StackDepth) {
  switch (depth) {
    case "front":
      return { x: "-7%", y: "-10.5%", zIndex: 3 };
    case "middle":
      return { x: "0%", y: "0%", zIndex: 2 };
    case "back":
      return { x: "7%", y: "10.5%", zIndex: 1 };
  }
}

const SLIDES = [
  {
    title: "CnC Academy",
    subtitle: "Learning center and training guides in one place",
    image: "/images/sell/sell-11.jpg",
  },
  {
    title: "Full CRM",
    subtitle: "Free client relationship management system built with AI",
    image: "/images/advantage-crm.jpg",
  },
  {
    title: "Transaction Management System",
    subtitle: "Our in-house TMS helps you save money and remain compliant",
    image: "/images/sell/sell-12.jpg",
  },
] as const;

function ArrowIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 30 30" fill="currentColor">
      <path d="M16 20.488c0-.13.053-.253.146-.344l13-13.002c.42-.44 1.174.24.706.707l-13 13c-.302.31-.853.096-.853-.362z" />
      <path d="M.852 7.142l14 14.002c.447.447-.273 1.16-.707.707l-14-14c-.444-.445.26-1.155.707-.708z" />
    </svg>
  );
}

export function AdvantageCarousel() {
  const [activeIdx, setActiveIdx] = useState(0);

  function goNext() {
    setActiveIdx((i) => (i + 1) % SLIDES.length);
  }

  function goPrev() {
    setActiveIdx((i) => (i - 1 + SLIDES.length) % SLIDES.length);
  }

  return (
    <div>
      <div className="relative mx-auto" style={{ width: "60vw", maxWidth: 820 }}>
        <div className="relative w-full" style={{ paddingTop: "calc(60vw / 1.45)", maxHeight: 566 }}>
          <div className="absolute inset-0">
            {SLIDES.map((slide, i) => {
              const depth = getStackDepth(i, activeIdx, SLIDES.length);
              return (
                <motion.div
                  key={slide.title}
                  className="absolute inset-0 overflow-hidden rounded-[22px] shadow-[5px_5px_20px_0px_rgba(0,0,0,0.4)]"
                  animate={stackAnimate(depth)}
                  transition={STACK_SPRING}
                >
                  <Image
                    src={slide.image}
                    alt={slide.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 820px) 60vw, 820px"
                    priority={i === 0}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute left-8 top-8 max-w-[70%]">
                    <p className="font-sans text-2xl font-medium text-white xl:text-3xl">
                      {slide.title}
                    </p>
                    <p className="mt-3 font-sans text-sm text-white/80 xl:text-base">
                      {slide.subtitle}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-12 flex justify-center gap-6">
        <motion.button
          onClick={goPrev}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          className="cursor-pointer rounded-full border border-[#1B1B1B]/50 p-3 text-[#1B1B1B]"
          style={{ rotate: "90deg" }}
          aria-label="Previous slide"
        >
          <ArrowIcon />
        </motion.button>
        <motion.button
          onClick={goNext}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          className="cursor-pointer rounded-full border border-[#1B1B1B]/50 p-3 text-[#1B1B1B]"
          style={{ rotate: "-90deg" }}
          aria-label="Next slide"
        >
          <ArrowIcon />
        </motion.button>
      </div>
    </div>
  );
}
