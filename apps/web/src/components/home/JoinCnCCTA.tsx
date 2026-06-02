"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { SPRING_HOVER } from "@/lib/motion";
import { RevealLine } from "@/components/ui/reveal-text";
import Image from "next/image";
import Link from "next/link";

const MotionLink = motion(Link);

export function JoinCnCCTA() {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

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
          top: "35vh",
          height: "65vh",
        }}
      >
        {/* Heading */}
        <div
          style={{ position: "absolute", top: "1.5rem", left: 0, right: 0, zIndex: 1 }}
          className="px-6 text-center"
        >
          <motion.h2
            className="font-sans font-light leading-[1.2]"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            viewport={{ once: true }}
          >
            <span className="block text-[2rem] xl:text-[2.5rem]">
              <RevealLine>Be the agent</RevealLine>
            </span>
            <span className="block text-[2.8rem] xl:text-[3.5rem]">
              <RevealLine delay={0.15}>you&apos;re <span style={{ color: "#9E8C61" }}>meant</span> to be</RevealLine>
            </span>
          </motion.h2>
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
            borderRadius: "1rem",
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
