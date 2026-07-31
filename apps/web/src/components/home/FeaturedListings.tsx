"use client";

import { motion, useInView } from "motion/react";
import Link from "next/link";
import { useRef } from "react";
import { RevealLine } from "@/components/ui/reveal-text";
import { useScramble } from "@/components/ui/ScrambleValue";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { ListingsMarquee } from "./ListingsMarquee";
import { PLACEHOLDER_LISTINGS, type FeaturedListing } from "@/lib/listings";

const MotionLink = motion(Link);

interface Props {
  listings?: FeaturedListing[];
  city: string;
  count: number;
}

export function FeaturedListings({ listings: propListings, city, count }: Props) {
  const source =
    propListings && propListings.length > 0 ? propListings : PLACEHOLDER_LISTINGS;

  const titleRef = useRef<HTMLDivElement>(null);
  // Same trigger condition RevealLine uses internally, so the number scramble
  // and the reveal sweep both start the moment the title enters view.
  const titleInView = useInView(titleRef, { once: true, margin: "-8%" });
  const scrambledCount = useScramble(`${count.toLocaleString()}+`, titleInView, 1200);

  return (
    <section data-navbar-theme="light" className="overflow-hidden bg-[#F2F0EF] py-10">
      <div ref={titleRef} className="mb-12 text-center">
        <h2 className="font-sans font-light leading-[1.05]">
          <span className="-ml-[1.6in] block text-[2.4rem] xl:text-[2.9rem] text-[#1B1B1B] tabular-nums">
            <RevealLine delay={0}>{scrambledCount} Listings in</RevealLine>
          </span>
          <span className="ml-[1.6in] block text-[3.2rem] xl:text-[3.8rem]">
            <RevealLine delay={0.15}>
              <span className="text-cnc-gold font-medium">{city}</span>
            </RevealLine>
          </span>
        </h2>
      </div>

      <ListingsMarquee listings={source} />

      <div className="mt-10 text-center">
        <MotionLink
          href="/properties"
          animate={PULSE_ANIMATE}
          whileHover={{ scale: 1.1, transition: SPRING_HOVER }}
          transition={PULSE_TRANSITION}
          className="inline-flex items-center rounded-full bg-[#1B1B1B] px-7 py-3.5 text-sm font-medium text-white"
        >
          View All
        </MotionLink>
      </div>
    </section>
  );
}
