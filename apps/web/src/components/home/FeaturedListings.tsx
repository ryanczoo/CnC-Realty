"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { RevealLine } from "@/components/ui/reveal-text";
import { SPRING_HOVER } from "@/lib/motion";
import { ListingsMarquee } from "./ListingsMarquee";
import { PLACEHOLDER_LISTINGS, type FeaturedListing } from "@/lib/listings";

const MotionLink = motion(Link);

interface Props {
  listings?: FeaturedListing[];
}

export function FeaturedListings({ listings: propListings }: Props) {
  const source =
    propListings && propListings.length > 0 ? propListings : PLACEHOLDER_LISTINGS;

  return (
    <section data-navbar-theme="light" className="overflow-hidden bg-[#F2F0EF] py-10">
      <div className="mb-12 pr-[8%] text-right">
        <h2 className="font-sans text-[2.5rem] font-light xl:text-[3rem]">
          <RevealLine>
            <span className="text-[1.9rem] xl:text-[2.2rem]">Exclusive </span>
            <span className="text-cnc-gold font-medium">Listings</span>
          </RevealLine>
        </h2>
      </div>

      <ListingsMarquee listings={source} />

      <div className="mt-10 text-center">
        <MotionLink
          href="/properties"
          whileHover={{ scale: 1.1, transition: SPRING_HOVER }}
          className="inline-flex items-center rounded-full bg-[#1B1B1B] px-7 py-3.5 text-sm font-medium text-white"
        >
          View All
        </MotionLink>
      </div>
    </section>
  );
}
