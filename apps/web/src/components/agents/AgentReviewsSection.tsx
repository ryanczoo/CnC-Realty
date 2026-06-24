"use client";

import { useState, useEffect, useRef } from "react";
import { Star } from "lucide-react";
import { motion } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

const PLACEHOLDER_REVIEWS = [
  {
    text: "Working with this agent was an incredible experience. They were professional, knowledgeable, and made the entire process seamless.",
    author: "Sarah M.",
    role: "Home Buyer",
  },
  {
    text: "Highly recommend! They went above and beyond to get our home sold quickly and at a great price. Truly exceptional service.",
    author: "James T.",
    role: "Home Seller",
  },
  {
    text: "As a first-time buyer I had a lot of questions. They were patient, thorough, and helped me find the perfect home.",
    author: "Priya K.",
    role: "First-Time Buyer",
  },
  {
    text: "From our first meeting to closing day, everything was handled with care and precision. I couldn't have asked for a better experience.",
    author: "Michael R.",
    role: "Home Buyer",
  },
  {
    text: "They negotiated a price well above what I expected. Responsive, honest, and genuinely invested in getting the best outcome for me.",
    author: "Linda C.",
    role: "Home Seller",
  },
  {
    text: "Relocating from out of state felt overwhelming, but they made it easy. Found us the perfect home in a neighborhood we love.",
    author: "David & Amy W.",
    role: "Relocation Buyers",
  },
  {
    text: "I've worked with several agents over the years and this was by far the smoothest transaction. Professional from start to finish.",
    author: "Tony B.",
    role: "Repeat Client",
  },
];

const VISIBLE = 3;
const MAX_IDX = PLACEHOLDER_REVIEWS.length - VISIBLE;

function ArrowIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 30 30" fill="currentColor">
      <path d="M16 20.488c0-.13.053-.253.146-.344l13-13.002c.42-.44 1.174.24.706.707l-13 13c-.302.31-.853.096-.853-.362z" />
      <path d="M.852 7.142l14 14.002c.447.447-.273 1.16-.707.707l-14-14c-.444-.445.26-1.155.707-.708z" />
    </svg>
  );
}

export function AgentReviewsSection({ displayName }: { displayName: string }) {
  void displayName;
  const [idx, setIdx] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const GAP = 16;
    function measure() {
      if (!containerRef.current) return;
      setCardWidth((containerRef.current.offsetWidth - GAP * (VISIBLE - 1)) / VISIBLE);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  function goPrev() { setIdx(i => Math.max(0, i - 1)); }
  function goNext() { setIdx(i => Math.min(MAX_IDX, i + 1)); }

  return (
    <section className="bg-cnc-bg px-6 py-20 md:px-12 lg:px-20">
      <div className="mx-auto max-w-6xl">

        {/* Header row — quote left, title right */}
        <div className="mb-12 flex items-start justify-between gap-8">
          <svg
            className="hidden shrink-0 opacity-[0.15] md:block"
            style={{ transform: "scaleX(-1)" }}
            width="40" height="40" viewBox="-0.5 0 25 25" fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M21.5 12.5C21.5 16.8 17.99 20.3 13.66 20.3" stroke="#1B1B1B" strokeMiterlimit="10" strokeLinecap="round"/>
            <path d="M21.5 12.5V5.20001C21.5 4.92001 21.28 4.70001 21 4.70001H14.16C13.88 4.70001 13.66 4.92001 13.66 5.20001V12C13.66 12.28 13.88 12.5 14.16 12.5H19.5" stroke="#1B1B1B" strokeMiterlimit="10" strokeLinecap="round"/>
            <path d="M10.34 12.5C10.34 16.8 6.83 20.3 2.5 20.3" stroke="#1B1B1B" strokeMiterlimit="10" strokeLinecap="round"/>
            <path d="M10.34 12.5V5.20001C10.34 4.92001 10.12 4.70001 9.84 4.70001H3C2.72 4.70001 2.5 4.92001 2.5 5.20001V12C2.5 12.28 2.72 12.5 3 12.5H8.34" stroke="#1B1B1B" strokeMiterlimit="10" strokeLinecap="round"/>
          </svg>
          <h2 className="text-right font-sans text-[2.5rem] font-light xl:text-[3rem]">
            <RevealLine>
              <span className="text-[1.9rem] xl:text-[2.2rem] text-[#1B1B1B]/70">Client </span>
              <span style={{ color: "#9E8C61", fontWeight: 500 }}>Reviews</span>
            </RevealLine>
          </h2>
        </div>

        {/* Carousel */}
        <div className="overflow-hidden" ref={containerRef}>
          <motion.div
            className="flex gap-4"
            animate={{ x: -(idx * (cardWidth + 16)) }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {PLACEHOLDER_REVIEWS.map((review) => (
              <div
                key={review.author}
                className="flex shrink-0 flex-col rounded-2xl border border-[#E0DDD8] bg-white p-6"
                style={{ width: cardWidth || "calc(33.333% - 11px)" }}
              >
                <div className="mb-4 flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={13} className="fill-[#9E8C61] text-[#9E8C61]" />
                  ))}
                </div>
                <p className="mb-5 flex-1 font-sans text-sm leading-relaxed text-[#1B1B1B]/60 italic">
                  &ldquo;{review.text}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8E5E0] font-sans text-xs font-medium text-[#1B1B1B]/50">
                    {review.author[0]}
                  </div>
                  <div>
                    <p className="font-sans text-xs font-semibold text-[#1B1B1B]">{review.author}</p>
                    <p className="font-sans text-[10px] text-[#1B1B1B]/40">{review.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Navigation — centered */}
        <div className="mt-8 flex items-center justify-center gap-6">
          <motion.button
            type="button"
            aria-label="Previous reviews"
            onClick={goPrev}
            disabled={idx === 0}
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            className="cursor-pointer rounded-full border border-[#1B1B1B]/50 p-3 text-[#1B1B1B] disabled:opacity-30"
            style={{ rotate: "90deg" }}
          >
            <ArrowIcon />
          </motion.button>
          <motion.button
            type="button"
            aria-label="Next reviews"
            onClick={goNext}
            disabled={idx === MAX_IDX}
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            className="cursor-pointer rounded-full border border-[#1B1B1B]/50 p-3 text-[#1B1B1B] disabled:opacity-30"
            style={{ rotate: "-90deg" }}
          >
            <ArrowIcon />
          </motion.button>
        </div>

      </div>
    </section>
  );
}
