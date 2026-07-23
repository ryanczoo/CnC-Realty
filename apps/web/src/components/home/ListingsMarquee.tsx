"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { FeaturedListing } from "@/lib/listings";

const STAGGER_OFFSETS = [0, 48, 24];
function cardOffset(i: number, total: number) {
  return STAGGER_OFFSETS[(i % total) % STAGGER_OFFSETS.length];
}

interface Props {
  listings: FeaturedListing[];
}

export function ListingsMarquee({ listings }: Props) {
  const [paused, setPaused] = useState(false);
  const doubled = [...listings, ...listings];

  return (
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

          return (
            <Link
              key={`${i}-${listing.address}`}
              href={href}
              className="group relative w-72 flex-shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:border-[#c9a84c]/60 hover:shadow-md"
              style={{
                height: "290px",
                transform: `translateY(${cardOffset(i, listings.length)}px)`,
              }}
            >
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
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
  );
}
