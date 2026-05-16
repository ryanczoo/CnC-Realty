"use client";

import { fadeUp, SPRING_HOVER } from "@/lib/motion";
import { motion } from "motion/react";
import Image from "next/image";
import { RevealText } from "@/components/ui/reveal-text";
import Link from "next/link";

const MotionLink = motion(Link);

export function JoinCnCCTA() {
  return (
    <section className="relative h-[60vh] w-full overflow-hidden">
      <Image
        src="/images/cta-bg.jpg"
        alt="Keys to your new home"
        fill
        className="object-cover object-center"
        priority
      />
      <div className="absolute inset-0 bg-black/55" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 px-6 text-center">
        <motion.h2
          className="font-sans font-light leading-[1.15]"
          {...fadeUp(0, 24)}
        >
          <span className="block whitespace-nowrap text-[2.5rem] xl:text-[3rem]"><RevealText onDark>Be the agent you&apos;re meant to be.</RevealText></span>
          <span className="block text-[3.5rem] xl:text-[4.2rem]"><RevealText onDark delay={0.15} className="opacity-50">Be CnC.</RevealText></span>
        </motion.h2>

        <motion.div {...fadeUp(0.15, 16)} className="flex flex-col items-center gap-4">
          <MotionLink
            href="/join"
            whileHover={{ scale: 1.05 }}
            transition={SPRING_HOVER}
            className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-medium text-cnc-dark transition-opacity hover:opacity-90"
          >
            Join Now
          </MotionLink>

        </motion.div>
      </div>
    </section>
  );
}
