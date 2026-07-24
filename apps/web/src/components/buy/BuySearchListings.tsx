"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RevealLine } from "@/components/ui/reveal-text";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { ListingsMarquee } from "@/components/home/ListingsMarquee";
import { buildPropertySearchParams } from "@/lib/property-search";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { PLACEHOLDER_LISTINGS, type FeaturedListing } from "@/lib/listings";

const MotionLink = motion(Link);

const SEARCH_PLACEHOLDERS = [
  'Search by city, zip, or address…',
  'Try "Los Angeles, CA"',
  'Try "90210"',
  'Try "3 bed homes in Pasadena"',
];

const noop = () => {};

interface Props {
  listings?: FeaturedListing[];
}

export function BuySearchListings({ listings: propListings }: Props) {
  const router = useRouter();
  const listings =
    propListings && propListings.length > 0 ? propListings : PLACEHOLDER_LISTINGS;

  return (
    <section data-navbar-theme="light" className="overflow-hidden bg-[#F2F0EF] py-20">
      <div className="mb-12 flex justify-center">
        <h2 className="text-center font-sans text-[2.8rem] font-light text-[#1B1B1B] xl:text-[3.4rem]">
          <RevealLine>
            <span className="text-[2.1rem] xl:text-[2.5rem]">Search </span>
            <span className="text-cnc-gold font-medium">Here</span>
          </RevealLine>
        </h2>
      </div>

      <div className="mx-auto mb-14 w-full max-w-xl px-4">
        <PlaceholdersAndVanishInput
          placeholders={SEARCH_PLACEHOLDERS}
          onChange={noop}
          onSubmit={(e) => {
            const input = (e.currentTarget as HTMLFormElement).querySelector(
              "input"
            ) as HTMLInputElement;
            const raw = input?.value?.trim();
            if (!raw) return;

            const params = buildPropertySearchParams(raw);
            router.push(`/properties?${params.toString()}`);
          }}
        />
      </div>

      <ListingsMarquee listings={listings} />

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
