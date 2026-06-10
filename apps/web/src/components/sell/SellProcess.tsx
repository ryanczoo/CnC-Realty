"use client";

import { useRef } from "react";
import { Fragment } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import Image from "next/image";
import Link from "next/link";

const MotionLink = motion(Link);
import { SPRING_HOVER, PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";

const STEPS = [
  {
    num: "01",
    title: "Valuation",
    body: "We analyze your home's market value using live CRMLS data, recent comparable sales, and local expertise to price your property for maximum return",
    photo: "/images/sell/sell-10.jpg",
    // Two overlapping photos shown in a slide panel before the text panel
    slideTop: "/images/sell/sell-slide-top.jpg",
    slideBottom: "/images/sell/sell-slide-bottom.jpg",
  },
  {
    num: "02",
    title: "Listing",
    body: "Professional photography, immaculate staging, effective agent communication, and immediate market exposure puts your home in front of every active buyer in California",
    photo: "/images/sell/sell-08.jpg",
    photoPos: "left center", // buildings on left — anchor to show them first
    slideTop: "/images/sell/sell-listing-slide-top.jpg",
    slideBottom: "/images/sell/sell-listing-slide-bottom.jpg",
    slideAfterText: true,
    slideShiftLeft: 96,
  },
  {
    num: "03",
    title: "Offers",
    body: "We present every offer clearly, walk you through the terms, and negotiate on your behalf to secure the best possible price and conditions",
    photo: "/images/sell/sell-14.jpg",
    slideTop: "/images/sell/sell-offers-slide-top.jpg",
    slideBottom: "/images/sell/sell-offers-slide-bottom.jpg",
  },
  {
    num: "04",
    title: "Closing",
    body: "From escrow coordination to final paperwork, we read every detail so you can sign with confidence and close on time",
    photo: "/images/sell/sell-09.jpg",
    slideTop: "/images/sell/sell-closing-slide-top.jpg",
    slideBottom: "/images/sell/sell-closing-slide-bottom.jpg",
    slideAfterText: true,
    slideShiftLeft: 192,
    cta: { label: "Start", href: "/contact" },
  },
];

// Panel widths (vw) — narrower than 100vw so adjacent panels always peek,
// replicating Fluid's side-peek split effect.
const INTRO_VW = 55;
const PHOTO_VW = 93;
const TEXT_VW = 40;
const SLIDE_VW = 46; // narrow — photos fill most of the panel width

const TOTAL_VW =
  INTRO_VW +
  STEPS.reduce((sum, s) => sum + PHOTO_VW + (s.slideTop ? SLIDE_VW : 0) + TEXT_VW, 0);
const TRAVEL_VW = TOTAL_VW - 100;

type Step = (typeof STEPS)[number];

function SlidePanel({ step, shiftLeft = 0 }: { step: Step; shiftLeft?: number }) {
  return (
    <div
      className="relative flex h-full items-center justify-center"
      style={{ width: `${SLIDE_VW}vw` }}
    >
      <div className="relative" style={{ width: "30.8vw", height: "34.6vw", transform: shiftLeft ? `translateX(-${shiftLeft}px)` : undefined }}>
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{ width: "18.8vw", height: "23.3vw", transform: "translateX(20%)" }}
        >
          <Image src={step.slideTop!} alt={`${step.title} top`} fill sizes="18.8vw" className="object-cover" />
        </div>
        <div
          className="absolute overflow-hidden rounded-2xl"
          style={{ width: "14.8vw", height: "18.4vw", left: "16.1vw", top: "16.3vw", zIndex: 1 }}
        >
          <Image src={step.slideBottom!} alt={`${step.title} bottom`} fill sizes="14.8vw" className="object-cover" />
        </div>
      </div>
    </div>
  );
}

export function SellProcess() {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const x = useTransform(scrollYProgress, [0, 1], ["0vw", `-${TRAVEL_VW}vw`]);

  // One useTransform per step — N must match STEPS.length (4). Ranges derived from N
  // so boundaries stay correct if steps are ever added/removed (and hook count updated).
  const N = STEPS.length;
  const seg0 = useTransform(scrollYProgress, [0 / N, 1 / N], [0, 1]);
  const seg1 = useTransform(scrollYProgress, [1 / N, 2 / N], [0, 1]);
  const seg2 = useTransform(scrollYProgress, [2 / N, 3 / N], [0, 1]);
  const seg3 = useTransform(scrollYProgress, [3 / N, 4 / N], [0, 1]);
  const SEG_FILLS = [seg0, seg1, seg2, seg3];

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="dark"
      className="relative bg-[#1B1B1B]"
      style={{ height: "900vh" }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">

        {/* Segmented progress bar */}
        <div className="absolute left-16 right-16 top-[5.25rem] z-20 flex gap-1">
          {SEG_FILLS.map((fill, i) => (
            <div
              key={i}
              className="flex-1 overflow-hidden"
              style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              <motion.div
                className="h-full origin-left bg-white"
                style={{ scaleX: fill }}
              />
            </div>
          ))}
        </div>

        {/* Our Process label */}
        <div className="absolute left-16 top-[6.25rem] z-20">
          <h2 className="font-sans text-[2.5rem] font-light xl:text-[3rem]">
            <RevealLine onDark>
              <span className="text-[1.9rem] xl:text-[2.2rem]">Our </span>
              <span style={{ color: "#9E8C61", fontWeight: 500 }}>Process</span>
            </RevealLine>
          </h2>
        </div>

        {/* Horizontal scroll row */}
        <motion.div
          className="flex h-full"
          style={{ x, width: `${TOTAL_VW}vw` }}
        >
          {/* Intro panel — 55vw */}
          <div
            className="flex h-full flex-col items-start justify-center px-16 lg:px-28"
            style={{ width: `${INTRO_VW}vw` }}
          >
            <h2 className="mb-6 max-w-2xl font-sans text-[3rem] font-light leading-tight text-white lg:text-[4.5rem]">
              We're here for you,<br />start to close
            </h2>
            <p className="max-w-md font-sans text-base font-light leading-relaxed text-white/40">
              From the first market analysis to the final signature, CnC will be with you every step of the way
            </p>
          </div>

          {/* Photo + optional slide + text panels × 4 */}
          {STEPS.map((step) => (
            <Fragment key={step.num}>

              {/* Full-bleed photo panel — 93vw */}
              <div
                className="relative h-full overflow-hidden"
                style={{ width: `${PHOTO_VW}vw` }}
              >
                <div className="absolute inset-0 scale-110">
                  <Image
                    src={step.photo}
                    alt={step.title}
                    fill
                    sizes={`${PHOTO_VW}vw`}
                    className="object-cover"
                    style={step.photoPos ? { objectPosition: step.photoPos } : undefined}
                    priority={step.num === "01"}
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/20" />
              </div>

              {/* Slide panel — before text (default) */}
              {step.slideTop && step.slideBottom && !step.slideAfterText && (
                <SlidePanel step={step} />
              )}

              {/* Step text panel */}
              <div
                className="relative flex h-full items-center"
                style={{ width: `${TEXT_VW}vw` }}
              >
                <div className="relative z-10 px-16 lg:px-28">
                  <div className="mb-10">
                    <span className="font-sans text-sm font-medium text-[#9E8C61]">{step.num}</span>
                  </div>
                  <h3 className="mb-6 font-sans text-[2.8rem] font-light leading-tight text-white lg:text-[3.8rem]">
                    {step.title}
                  </h3>
                  <p className="max-w-sm font-sans text-base font-light leading-relaxed text-white/50">
                    {step.body}
                  </p>
                  {step.cta && (
                    <MotionLink
                      href={step.cta.href}
                      animate={PULSE_ANIMATE}
                      whileHover={{ scale: 1.1, transition: SPRING_HOVER }}
                      transition={PULSE_TRANSITION}
                      className="mt-20 inline-flex rounded-full bg-white px-8 py-3.5 font-sans text-sm font-medium text-[#1B1B1B]"
                    >
                      {step.cta.label}
                    </MotionLink>
                  )}
                </div>
              </div>

              {/* Slide panel — after text (when slideAfterText: true) */}
              {step.slideTop && step.slideBottom && step.slideAfterText && (
                <SlidePanel step={step} shiftLeft={step.slideShiftLeft ?? 0} />
              )}

            </Fragment>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
