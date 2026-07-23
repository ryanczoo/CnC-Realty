"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { RevealLine } from "@/components/ui/reveal-text";
import { SPRING_HOVER } from "@/lib/motion";
import { PLACEHOLDER_LISTINGS, type FeaturedListing } from "@/lib/listings";

const MotionLink = motion(Link);

const STAGGER_OFFSETS = [0, 48, 24];
function cardOffset(i: number, total: number) {
  return STAGGER_OFFSETS[(i % total) % STAGGER_OFFSETS.length];
}

interface Props {
  listings?: FeaturedListing[];
}

export function FeaturedListings({ listings: propListings }: Props) {
  const [paused, setPaused] = useState(false);

  const source =
    propListings && propListings.length > 0 ? propListings : PLACEHOLDER_LISTINGS;
  const doubled = [...source, ...source];

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

      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Fade edges */}
        <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-32 bg-gradient-to-r from-[#F2F0EF] to-transparent" />
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-32 bg-gradient-to-l from-[#F2F0EF] to-transparent" />

        <div
          className="flex items-start gap-5 px-5 pb-16 pt-2"
          style={{
            animation: "testimonial-scroll 80s linear infinite",
            animationPlayState: paused ? "paused" : "running",
            width: "max-content",
          }}
        >
          {doubled.map((listing, i) => {
            const displayPrice = listing.listPrice
              ? `$${listing.listPrice.toLocaleString()}`
              : listing.price ?? "";
            const thumb = listing.photos?.[0] ?? listing.image ?? null;
            const href = listing.mlsNumber
              ? `/properties/${listing.mlsNumber}`
              : "/properties";
            const sqftDisplay =
              typeof listing.sqft === "number"
                ? listing.sqft.toLocaleString()
                : (listing.sqft ?? "");

            return (
              <Link
                key={`${i}-${listing.address}`}
                href={href}
                className="group relative w-72 flex-shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:border-[#c9a84c]/60 hover:shadow-md"
                style={{
                  height: "290px",
                  transform: `translateY(${cardOffset(i, source.length)}px)`,
                }}
              >
                {/* Full-height image */}
                <div className="relative h-full w-full">
                  {thumb ? (
                    <Image
                      src={thumb}
                      alt={listing.address}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="288px"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-xs text-zinc-400">
                      No photo
                    </div>
                  )}
                  {/* Dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  {/* Status badge */}
                  <span
                    className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold"
                    style={
                      listing.status === "Open House"
                        ? { background: "#9E8C61", color: "#fff" }
                        : {
                            background: "rgba(0,0,0,0.65)",
                            color: "#fff",
                            border: "1px solid rgba(255,255,255,0.2)",
                          }
                    }
                  >
                    {listing.status}
                  </span>
                  {/* Price + address overlay at bottom */}
                  <div className="absolute bottom-0 left-0 p-4">
                    <p className="text-base font-bold text-white">{displayPrice}</p>
                    <p className="text-xs font-medium text-white/90">{listing.address}</p>
                    <p className="text-xs text-white/65">{listing.city}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

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
