"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { SPRING_HOVER } from "@/lib/motion";
import Image from "next/image";
import Link from "next/link";

const MotionLink = motion(Link);

export function JoinCnCCTA() {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Image expands from small card → fills the 65vh sticky section
  const imgWidth = useTransform(scrollYProgress, [0.1, 0.88], ["52%", "100%"]);
  const imgHeight = useTransform(scrollYProgress, [0.1, 0.88], ["42vh", "65vh"]);

  // "Be the agent..." fades as the expanding image approaches it from above
  const headingOpacity = useTransform(scrollYProgress, [0.65, 0.85], [1, 0]);

  // "Be CnC." + button only appear AFTER "Be the agent..." is fully gone (≥0.85)
  const overlayOpacity = useTransform(scrollYProgress, [0.85, 0.95], [0, 1]);

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="dark"
      className="bg-[#F2F0EF]"
      style={{ height: "200vh" }}
    >
      {/* Sticky container — centered 65vh, matches the section height */}
      <div
        className="overflow-hidden"
        style={{
          position: "sticky",
          top: "calc((100vh - 65vh) / 2)",
          height: "65vh",
        }}
      >
        {/* Image — centered in the 65vh area, grows to fill it */}
        <motion.div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            x: "-50%",
            y: "-50%",
            width: imgWidth,
            height: imgHeight,
            overflow: "hidden",
            zIndex: 2,
          }}
        >
          <Image
            src="/images/cta-bg.jpg"
            alt="Join CnC Realty"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-black/50" />

          {/* "Be CnC." + button — only visible after "Be the agent..." is gone */}
          <motion.div
            style={{ opacity: overlayOpacity }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-6 text-center"
          >
            <span className="block font-sans text-[3.5rem] font-light text-white opacity-60 xl:text-[4.2rem]">
              Be CnC.
            </span>
            <MotionLink
              href="/join"
              whileHover={{ scale: 1.05 }}
              transition={SPRING_HOVER}
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 font-sans text-sm font-medium text-cnc-dark transition-opacity hover:opacity-90"
            >
              Join Now →
            </MotionLink>
          </motion.div>
        </motion.div>

        {/* "Be the agent..." — sits at the bottom of the sticky area, behind the image.
            As the image expands downward it physically covers this text. */}
        <motion.div
          style={{
            position: "absolute",
            bottom: "1.5rem",
            left: 0,
            right: 0,
            zIndex: 1,
            opacity: headingOpacity,
          }}
          className="px-6 text-center"
        >
          <h2 className="font-sans text-[2rem] font-light leading-[1.15] text-[#1B1B1B] lg:text-[2.5rem]">
            Be the agent you&apos;re meant to be.
          </h2>
        </motion.div>
      </div>
    </section>
  );
}
