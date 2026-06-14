"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { RevealLine } from "@/components/ui/reveal-text";

const STEPS = [
  {
    title: { first: "Get", mid: "", last: "Pre-Approved" },
    body: "Connect with a lender to understand your budget before falling in love with a home. Our team works with multiple lenders for a fast and smooth approval",
    img: "/images/buy/buy-step-01.jpg",
  },
  {
    title: { first: "Find", mid: "Your", last: "Agent" },
    body: "CnC has agents all across California. Match with an expert today to get local expertise for your neighborhood",
    img: "/images/buy/buy-step-02.jpg",
  },
  {
    title: { first: "Search", mid: "&", last: "Tour" },
    body: "Use our property search tool to browse all active homes for sale, and schedule a tour directly in our website to move fast when the right home appears",
    img: "/images/buy/buy-step-03.jpg",
  },
  {
    title: { first: "Closing", mid: "", last: "Escrow" },
    body: "From offer to keys, your CnC agent handles the contracts, negotiations, inspections, and escrow — so you can focus on the move",
    img: "/images/buy/buy-step-04.jpg",
  },
];

function StepImage({ step, i }: { step: (typeof STEPS)[0]; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl"
      style={{ height: "340px" }}
    >
      <Image
        src={step.img}
        alt={`${step.title.first} ${step.title.last}`}
        fill
        className="object-cover"
        sizes="(max-width: 1024px) 100vw, 45vw"
        loading={i === 0 ? "eager" : "lazy"}
      />
    </motion.div>
  );
}

function StepText({
  step,
  i,
  align,
}: {
  step: (typeof STEPS)[0];
  i: number;
  align: "left" | "right";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: align === "left" ? -20 : 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="relative"
    >
      <div
        className={`relative flex flex-col gap-20 ${align === "right" ? "items-end text-right" : "items-start text-left"}`}
      >
        <div className="flex flex-col gap-3">
          <span className="font-sans text-sm font-medium text-[#9E8C61]">
            {String(i + 1).padStart(2, "0")}
          </span>
          <h2 className="font-sans text-[2.2rem] font-light leading-tight xl:text-[2.7rem]">
            <RevealLine>
              <span className="text-[1.7rem] xl:text-[2.1rem]">
                {step.title.first}
                {step.title.mid && ` ${step.title.mid}`}{" "}
              </span>
              <span className="text-cnc-gold font-medium">{step.title.last}</span>
            </RevealLine>
          </h2>
        </div>
        <p className="max-w-md font-sans text-[1rem] leading-relaxed text-[#1B1B1B]/60">
          {step.body}
        </p>
      </div>
    </motion.div>
  );
}

export function BuySteps() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start center", "end center"],
  });

  const seg0 = useTransform(scrollYProgress, [0, 0.25], ["0%", "100%"]);
  const seg1 = useTransform(scrollYProgress, [0.25, 0.5], ["0%", "100%"]);
  const seg2 = useTransform(scrollYProgress, [0.5, 0.75], ["0%", "100%"]);
  const seg3 = useTransform(scrollYProgress, [0.75, 1.0], ["0%", "100%"]);
  const segHeights = [seg0, seg1, seg2, seg3];

  return (
    <section ref={sectionRef} className="relative bg-[#F2F0EF] px-8 py-24 lg:px-20">
      <div className="relative mx-auto max-w-7xl">

        {/* Vertical center line — segmented, matches site progress bar style */}
        <div className="absolute inset-y-0 left-1/2 flex w-[2px] -translate-x-1/2 flex-col gap-4">
          {segHeights.map((h, i) => (
            <div key={i} className="flex-1 overflow-hidden" style={{ backgroundColor: "rgba(27,27,27,0.12)" }}>
              <motion.div className="w-full bg-[#1B1B1B]" style={{ height: h }} />
            </div>
          ))}
        </div>

        {/* Step rows */}
        {STEPS.map((step, i) => {
          const imageLeft = i % 2 === 0;
          return (
            <div key={i} className="relative flex items-center py-16">

              {/* Left content */}
              <div className="flex-1 pr-12">
                {imageLeft
                  ? <StepImage step={step} i={i} />
                  : <StepText step={step} i={i} align="left" />
                }
              </div>

              {/* Center spacer — keeps content off the line */}
              <div className="w-16 flex-shrink-0" />

              {/* Right content */}
              <div className="flex-1 pl-12">
                {imageLeft
                  ? <StepText step={step} i={i} align="right" />
                  : <StepImage step={step} i={i} />
                }
              </div>

            </div>
          );
        })}
      </div>
    </section>
  );
}
