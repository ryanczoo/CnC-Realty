"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import {
  EASE_OUT_EXPO,
  PULSE_ANIMATE,
  PULSE_TRANSITION,
  SPRING_HOVER,
} from "@/lib/motion";

const CITIES = [
  { name: "Los Angeles",   src: "/images/cities/los-angeles.jpg",   href: "/properties?listingType=FOR_SALE&query=Los+Angeles" },
  { name: "San Francisco", src: "/images/cities/san-francisco.jpg", href: "/properties?listingType=FOR_SALE&query=San+Francisco" },
  { name: "San Diego",     src: "/images/cities/san-diego.webp",    href: "/properties?listingType=FOR_SALE&query=San+Diego" },
  { name: "Sacramento",    src: "/images/cities/sacramento.jpg",    href: "/properties?listingType=FOR_SALE&query=Sacramento" },
  { name: "San Jose",      src: "/images/cities/san-jose.jpg",      href: "/properties?listingType=FOR_SALE&query=San+Jose" },
] as const;

const INTERVAL_MS = 5000;

export type SlidePosition = "active" | "prev" | "next" | "hidden";

export function getSlideState(
  idx: number,
  activeIdx: number,
  total: number
): SlidePosition {
  if (idx === activeIdx) return "active";
  if (idx === (activeIdx - 1 + total) % total) return "prev";
  if (idx === (activeIdx + 1) % total) return "next";
  return "hidden";
}

function slideAnimate(pos: SlidePosition) {
  switch (pos) {
    case "active": return { x: "0vw",   opacity: 1,    scale: 1,    zIndex: 10 };
    case "prev":   return { x: "-55vw", opacity: 0.45, scale: 0.88, zIndex: 1  };
    case "next":   return { x: "55vw",  opacity: 0.45, scale: 0.88, zIndex: 1  };
    case "hidden": return { x: "0vw",   opacity: 0,    scale: 0.88, zIndex: 0  };
  }
}

function ArrowIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 30 30" fill="currentColor">
      <path d="M16 20.488c0-.13.053-.253.146-.344l13-13.002c.42-.44 1.174.24.706.707l-13 13c-.302.31-.853.096-.853-.362z" />
      <path d="M.852 7.142l14 14.002c.447.447-.273 1.16-.707.707l-14-14c-.444-.445.26-1.155.707-.708z" />
    </svg>
  );
}

export function RentCitiesSlider() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;
    const id = setInterval(() => {
      setActiveIdx(i => (i + 1) % CITIES.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [isHovered]);

  function goNext() {
    setActiveIdx(i => (i + 1) % CITIES.length);
  }

  function goPrev() {
    setActiveIdx(i => (i - 1 + CITIES.length) % CITIES.length);
  }

  return (
    <section data-navbar-theme="dark" className="bg-[#1B1B1B] py-20 overflow-hidden">
      <div className="mb-10 flex justify-end px-8 lg:px-20">
        <h2 className="font-sans text-[2.5rem] font-light xl:text-[3rem]">
          <RevealLine>
            <span className="text-[1.9rem] xl:text-[2.2rem] text-white/80">Popular </span>
            <span style={{ color: "#9E8C61", fontWeight: 500 }}>Cities</span>
          </RevealLine>
        </h2>
      </div>

      <div
        className="relative mx-auto"
        style={{ width: "65vw", maxWidth: 900 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative w-full" style={{ paddingTop: "calc(65vw * 9 / 16)", maxHeight: 506 }}>
          <div className="absolute inset-0">
            {CITIES.map((city, i) => {
              const pos = getSlideState(i, activeIdx, CITIES.length);
              return (
                <motion.div
                  key={city.name}
                  className="absolute inset-0 rounded-2xl overflow-hidden"
                  animate={slideAnimate(pos)}
                  transition={
                    pos === "hidden"
                      ? { duration: 0 }
                      : { duration: 0.6, ease: EASE_OUT_EXPO as [number, number, number, number] }
                  }
                >
                  <Image
                    src={city.src}
                    alt={city.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 900px) 65vw, 900px"
                    priority={i === 0}
                  />
                  <div className="absolute inset-0 bg-black/40" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="font-sans font-light text-white text-[2.2rem] xl:text-[2.6rem]">
                      {city.name}
                    </p>
                  </div>
                  {pos === "active" && (
                    <motion.div
                      className="absolute bottom-6 right-6"
                      animate={PULSE_ANIMATE}
                      transition={PULSE_TRANSITION}
                      whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
                    >
                      <Link
                        href={city.href}
                        className="flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-5 py-2.5 backdrop-blur-sm transition-colors hover:bg-white/20"
                      >
                        <span className="font-sans text-sm font-light text-white">Search Here</span>
                      </Link>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex gap-6 justify-center mt-12">
        <motion.button
          onClick={goPrev}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          className="text-white border border-white/50 rounded-full p-3 cursor-pointer"
          style={{ rotate: "90deg" }}
          aria-label="Previous city"
        >
          <ArrowIcon />
        </motion.button>
        <motion.button
          onClick={goNext}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          className="text-white border border-white/50 rounded-full p-3 cursor-pointer"
          style={{ rotate: "-90deg" }}
          aria-label="Next city"
        >
          <ArrowIcon />
        </motion.button>
      </div>
    </section>
  );
}
