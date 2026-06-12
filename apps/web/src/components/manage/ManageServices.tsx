"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER, fadeUp } from "@/lib/motion";

const MotionLink = motion(Link);

export function ManageServices() {
  return (
    <section data-navbar-theme="light" className="bg-[#F2F0EF] text-[#1B1B1B] py-24 md:py-[150px] overflow-hidden">
      <div className="mx-auto max-w-[1920px] px-10 md:px-[100px]">
        <div className="grid gap-12 md:grid-cols-2 md:gap-20 items-center">
          <motion.h2
            {...fadeUp(0)}
            className="font-sans font-medium text-[42px] leading-[105%] tracking-[-0.02em] md:text-[68px] md:leading-[100%] md:tracking-[-0.04em]"
          >
            Property Management,{" "}
            <span className="text-[#1B1B1B]/40">Fully Handled.</span>
          </motion.h2>

          <motion.div {...fadeUp(0.1)} className="flex flex-col gap-8">
            <p className="font-sans font-medium text-[20px] leading-[130%] md:text-[26px] md:leading-[120%] md:tracking-[-0.02em]">
              The rental market never slows down — and neither do we.{" "}
              <span className="text-[#1B1B1B]/40">
                Our team handles everything from tenant placement to monthly
                reporting so you can collect checks, not calls.
              </span>
            </p>

            <div>
              <MotionLink
                href="/contact"
                animate={PULSE_ANIMATE}
                transition={PULSE_TRANSITION}
                whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
                className="inline-flex items-center gap-2 rounded-full bg-[#1B1B1B] px-8 py-4 font-sans text-sm font-medium text-white"
              >
                Get a Free Consultation →
              </MotionLink>
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
}
