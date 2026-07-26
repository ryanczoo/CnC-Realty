"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { fadeUp } from "@/lib/motion";

export function TestimonialCards() {
  return (
    <section data-navbar-theme="light" className="relative bg-[#F2F0EF] pt-16">
      {/* Staggered layout: all 6 boxes same fixed height, side columns offset downward */}
      <div style={{ display: "flex", gap: "1px", backgroundColor: "#F2F0EF", alignItems: "flex-start" }}>
        {/* Left column — offset down by 200px */}
        <div className="flex flex-1 flex-col" style={{ marginTop: "200px", gap: "1px" }}>
          <motion.div {...fadeUp(0)} style={{ height: "420px", overflow: "hidden", position: "relative" }}>
            <Image src="/images/testimonials-left.jpg" alt="" fill className="object-cover" />
          </motion.div>
          <motion.div
            {...fadeUp(0.06)}
            className="flex flex-col bg-white px-10 py-10"
            style={{ height: "420px" }}
          >
            <p className="font-sans text-[1.05rem] leading-[1.85] text-[#1B1B1B]">
              Working with CnC Realty has been an inspiring experience. Their deep
              knowledge of the real estate sector, combined with a dynamic and
              dedicated team, authentically guided us through every step and
              amplified our confidence throughout the entire process.
            </p>
            <p className="mt-4 font-sans text-[1.05rem] leading-[1.85] text-[#1B1B1B]">
              A partnership we truly value and look forward to continuing.
            </p>
            <div className="mt-auto border-t border-[#1B1B1B]/15 pt-5">
              <p className="font-sans text-sm font-medium text-[#1B1B1B]">Kevin Luevanos</p>
              <p className="font-sans text-xs text-[#1B1B1B]/45">Prime Construction LLC</p>
            </div>
          </motion.div>
        </div>

        {/* Center column — starts at top */}
        <div className="flex flex-1 flex-col" style={{ gap: "1px" }}>
          <motion.div
            {...fadeUp(0.08)}
            className="flex flex-col bg-[#1B1B1B] px-10 py-10"
            style={{ height: "420px" }}
          >
            <p className="font-sans text-[1.05rem] leading-[1.85] text-white">
              Last year when my husband and I bought our home, we had no idea where
              to start! CnC really made the homebuying process easy and we couldn&apos;t
              be happier with our purchase. Highly recommend reaching out to get some
              helpful insight before making the first step.
            </p>
            <div className="mt-auto border-t border-white/15 pt-5">
              <p className="font-sans text-sm font-medium text-white">Jessica Meyes</p>
              <p className="font-sans text-xs text-white/40">First Time Homeowner</p>
            </div>
          </motion.div>
          <motion.div {...fadeUp(0.12)} style={{ height: "420px", overflow: "hidden", position: "relative" }}>
            <Image src="/images/testimonials-center.jpg" alt="" fill className="object-cover" />
          </motion.div>
          <motion.div
            {...fadeUp(0.16)}
            className="flex flex-col bg-[#1B1B1B] px-10 py-10"
            style={{ height: "420px" }}
          >
            <p className="font-sans text-[1.05rem] leading-[1.85] text-white">
              Much appreciation for the folks over at CnC — not only did I get top
              dollar for my home, but I moved into a bigger home with a 1031 exchange.
              If you want the best communication, knowledge, and professionalism, you
              have to give CnC a call.
            </p>
            <div className="mt-auto border-t border-white/15 pt-5">
              <p className="font-sans text-sm font-medium text-white">Raymond Lee</p>
              <p className="font-sans text-xs text-white/40">SoCal Resident & Investor</p>
            </div>
          </motion.div>
        </div>

        {/* Right column — offset down by 200px */}
        <div className="flex flex-1 flex-col" style={{ marginTop: "200px", gap: "1px" }}>
          <motion.div {...fadeUp(0.04)} style={{ height: "420px", overflow: "hidden", position: "relative" }}>
            <Image src="/images/testimonials-right.jpg" alt="" fill className="object-cover" />
          </motion.div>
          <motion.div
            {...fadeUp(0.10)}
            className="flex flex-col bg-white px-10 py-10"
            style={{ height: "420px" }}
          >
            <p className="font-sans text-[1.05rem] leading-[1.85] text-[#1B1B1B]">
              My experience switching from my previous brokerage to CnC has exceeded
              my expectations. Being able to take home ALL of my commission has really
              changed the game for me. I am able to commit more time to client outreach
              and less time balancing my day-job.
            </p>
            <div className="mt-auto border-t border-[#1B1B1B]/15 pt-5">
              <p className="font-sans text-sm font-medium text-[#1B1B1B]">Rachel Kent</p>
              <p className="font-sans text-xs text-[#1B1B1B]/45">Real Estate Agent</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
