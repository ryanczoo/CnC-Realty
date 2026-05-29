"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "motion/react";
import { EASE_OUT_EXPO, SPRING_HOVER } from "@/lib/motion";
import Image from "next/image";
import Link from "next/link";

const MotionLink = motion(Link);

export function JoinCnCCTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const isHeadingInView = useInView(headingRef, { once: true, margin: "-8%" });

  const imgWidth = useTransform(scrollYProgress, [0.1, 0.88], ["52%", "100%"]);
  const imgHeight = useTransform(scrollYProgress, [0.1, 0.88], ["42vh", "65vh"]);
  const overlayOpacity = useTransform(scrollYProgress, [0.85, 0.95], [0, 1]);

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="dark"
      className="bg-[#F2F0EF]"
      style={{ height: "200vh" }}
    >
      <div
        style={{
          position: "sticky",
          top: "calc(100vh - 65vh)",
          height: "65vh",
        }}
      >
        {/* Heading — matches FAQ pattern exactly: fade-up wrapper + gray-first reveal */}
        <div
          style={{ position: "absolute", top: "1.5rem", left: 0, right: 0, zIndex: 1 }}
          className="px-6 text-center"
        >
          <motion.div
            ref={headingRef}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            viewport={{ once: true }}
            style={{ position: "relative" }}
          >
            {/* Dim base layer — always visible, gray/dim gold — the "gray" state the user sees */}
            <h2
              aria-hidden="true"
              className="font-sans text-[2.8rem] font-light leading-[1.3] xl:text-[3.5rem]"
            >
              <span style={{ color: "rgba(27,27,27,0.18)" }}>{"Be the agent you're "}</span>
              <span style={{ color: "rgba(158,140,97,0.18)" }}>meant</span>
              <span style={{ color: "rgba(27,27,27,0.18)" }}>{" to be"}</span>
            </h2>

            {/* Bright overlay — same text, full color, masked left-to-right in 1.2s (same as RevealText) */}
            <h2
              className="font-sans text-[2.8rem] font-light leading-[1.3] xl:text-[3.5rem]"
              style={{
                position: "absolute",
                inset: 0,
                WebkitMaskImage: "linear-gradient(to right, black 50%, transparent 50%)",
                maskImage: "linear-gradient(to right, black 50%, transparent 50%)",
                WebkitMaskSize: "200% 100%",
                maskSize: "200% 100%",
                WebkitMaskPosition: isHeadingInView ? "0% 0%" : "100% 0%",
                maskPosition: isHeadingInView ? "0% 0%" : "100% 0%",
                transitionProperty: "mask-position, -webkit-mask-position",
                transitionDuration: "1.2s",
                transitionTimingFunction: `cubic-bezier(${EASE_OUT_EXPO.join(",")})`,
              } as React.CSSProperties}
            >
              <span style={{ color: "#1B1B1B" }}>{"Be the agent you're "}</span>
              <span style={{ color: "#9E8C61" }}>meant</span>
              <span style={{ color: "#1B1B1B" }}>{" to be"}</span>
            </h2>
          </motion.div>
        </div>

        {/* Image — expands from center to fill sticky area */}
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

          {/* "Be CnC" + button — appears after image is fully expanded */}
          <motion.div
            style={{ opacity: overlayOpacity }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-6 text-center"
          >
            <span className="block font-sans text-[3.5rem] font-light text-white xl:text-[4.2rem]">
              Be CnC
            </span>
            <MotionLink
              href="/join"
              whileHover={{ scale: 1.05 }}
              transition={SPRING_HOVER}
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 font-sans text-sm font-medium text-cnc-dark transition-opacity hover:opacity-90"
            >
              Join Now
            </MotionLink>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
