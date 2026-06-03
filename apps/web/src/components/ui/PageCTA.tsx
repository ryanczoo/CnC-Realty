"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import { CTALineArt } from "@/components/join/CTALineArt";
import { SPRING_HOVER } from "@/lib/motion";

const MotionLink = motion(Link);

interface PageCTAProps {
  heading: React.ReactNode;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function PageCTA({
  heading,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: PageCTAProps) {
  return (
    <section className="relative overflow-hidden bg-[#F2F0EF] px-8 py-28 lg:px-20">
      <CTALineArt />
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <h2 className="mb-4 font-sans text-[2.5rem] font-light leading-tight">
          <RevealLine>{heading}</RevealLine>
        </h2>
        <p className="mb-10 font-sans text-base text-[#1B1B1B]/60">{body}</p>
        <div className="flex justify-center gap-4">
          <MotionLink
            href={primaryHref}
            whileHover={{ scale: 1.05 }}
            transition={SPRING_HOVER}
            className="inline-flex items-center rounded-full bg-[#9E8C61] px-8 py-3.5 font-sans text-sm font-medium text-white"
          >
            {primaryLabel}
          </MotionLink>
          {secondaryHref && secondaryLabel && (
            <MotionLink
              href={secondaryHref}
              whileHover={{ scale: 1.05 }}
              transition={SPRING_HOVER}
              className="inline-flex items-center rounded-full border border-[#1B1B1B]/20 px-8 py-3.5 font-sans text-sm font-medium text-[#1B1B1B]"
            >
              {secondaryLabel}
            </MotionLink>
          )}
        </div>
      </div>
    </section>
  );
}
