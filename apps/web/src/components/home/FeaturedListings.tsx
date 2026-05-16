"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { RevealText } from "@/components/ui/reveal-text";

const LISTINGS = [
  {
    price: "$1,250,000",
    beds: 4,
    baths: 3,
    sqft: "2,450",
    address: "1847 Oak Glen Dr",
    city: "Pasadena, CA",
    status: "For Sale",
    image: "https://picsum.photos/seed/house1/600/400",
  },
  {
    price: "$875,000",
    beds: 3,
    baths: 2,
    sqft: "1,820",
    address: "534 Magnolia Ave",
    city: "Glendale, CA",
    status: "For Sale",
    image: "https://picsum.photos/seed/house2/600/400",
  },
  {
    price: "$2,100,000",
    beds: 5,
    baths: 4,
    sqft: "4,100",
    address: "291 Wistaria Ave",
    city: "Arcadia, CA",
    status: "Open House",
    image: "https://picsum.photos/seed/house3/600/400",
  },
  {
    price: "$649,000",
    beds: 2,
    baths: 2,
    sqft: "1,210",
    address: "88 Olive St #4B",
    city: "Burbank, CA",
    status: "For Sale",
    image: "https://picsum.photos/seed/house4/600/400",
  },
  {
    price: "$1,050,000",
    beds: 3,
    baths: 3,
    sqft: "2,180",
    address: "702 Huntington Dr",
    city: "San Marino, CA",
    status: "For Sale",
    image: "https://picsum.photos/seed/house5/600/400",
  },
  {
    price: "$895,000",
    beds: 4,
    baths: 2,
    sqft: "1,960",
    address: "1103 Foothill Blvd",
    city: "Monrovia, CA",
    status: "Open House",
    image: "https://picsum.photos/seed/house6/600/400",
  },
  {
    price: "$1,495,000",
    beds: 4,
    baths: 3,
    sqft: "3,020",
    address: "445 Sierra Madre Blvd",
    city: "Sierra Madre, CA",
    status: "For Sale",
    image: "https://picsum.photos/seed/house7/600/400",
  },
  {
    price: "$735,000",
    beds: 3,
    baths: 2,
    sqft: "1,540",
    address: "2210 Rosemead Blvd",
    city: "Temple City, CA",
    status: "For Sale",
    image: "https://picsum.photos/seed/house8/600/400",
  },
];

const DOUBLED = [...LISTINGS, ...LISTINGS];

// 3-tier stagger: low → high → mid, cycling per card
// Use (i % LISTINGS.length) so both loop halves have identical offsets for a seamless repeat
const STAGGER_OFFSETS = [0, 48, 24];
function cardOffset(i: number) {
  return STAGGER_OFFSETS[(i % LISTINGS.length) % STAGGER_OFFSETS.length];
}

export function FeaturedListings() {
  const [paused, setPaused] = useState(false);

  return (
    <section className="overflow-hidden bg-[#F2F0EF] py-10">
      <div className="mb-12 px-4 text-center">
        <h2 className="font-sans text-[2.5rem] font-light xl:text-[3rem]">
          <RevealText>Exclusive Listings</RevealText>
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
          {DOUBLED.map((listing, i) => (
            <div
              key={`${i}-${listing.address}`}
              className="group w-72 flex-shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:border-[#c9a84c]/60 hover:shadow-md"
              style={{ transform: `translateY(${cardOffset(i)}px)` }}
            >
              {/* Image */}
              <div className="relative h-48 overflow-hidden">
                <img
                  src={listing.image}
                  alt={listing.address}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Status badge */}
                <span
                  className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold"
                  style={
                    listing.status === "Open House"
                      ? { background: "#9E8C61", color: "#fff" }
                      : { background: "rgba(0,0,0,0.65)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }
                  }
                >
                  {listing.status}
                </span>
              </div>

              {/* Details */}
              <div className="flex flex-col gap-2 p-4">
                <p className="text-lg font-bold text-[#1B1B1B]">{listing.price}</p>
                <div className="flex items-center gap-3 text-xs text-[#1B1B1B]/50">
                  <span>{listing.beds} bd</span>
                  <span className="text-[#1B1B1B]/20">·</span>
                  <span>{listing.baths} ba</span>
                  <span className="text-[#1B1B1B]/20">·</span>
                  <span>{listing.sqft} sqft</span>
                </div>
                <div className="mt-1 border-t border-[#1B1B1B]/10 pt-3">
                  <p className="text-sm font-medium text-[#1B1B1B]/75">{listing.address}</p>
                  <p className="text-xs text-[#1B1B1B]/45">{listing.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 text-center">
        <motion.div
          className="inline-block"
          whileHover={{ scale: 1.1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Link
            href="/properties"
            className="inline-flex items-center rounded-full bg-[#1B1B1B] px-7 py-3.5 text-sm font-medium text-white"
          >
            View All →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
