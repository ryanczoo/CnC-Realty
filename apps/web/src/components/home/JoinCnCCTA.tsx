"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useScroll, useTransform } from "motion/react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SPRING_HOVER, PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";
import { RevealLine } from "@/components/ui/reveal-text";
import Image from "next/image";
import Link from "next/link";

const MotionLink = motion(Link);

// Image growth across the section's scroll. Desktop numbers are the original
// useTransform ranges; phones start larger (less to grow) and shorter (so the
// heading above stays readable before the image covers it).
export function ctaImageSize(t: number, mobile: boolean): { width: string; height: string } {
  const p = Math.min(1, Math.max(0, (t - 0.1) / 0.78));
  return mobile
    ? { width: `${80 + 20 * p}%`, height: `${30 + 35 * p}svh` }
    : { width: `${52 + 48 * p}%`, height: `${42 + 23 * p}vh` };
}

export function JoinCnCCTA() {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const isMobile = useIsMobile();
  const mobileMV = useMotionValue(isMobile ? 1 : 0);
  useEffect(() => { mobileMV.set(isMobile ? 1 : 0); }, [isMobile, mobileMV]);
  const imgWidth = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => ctaImageSize(t, m === 1).width);
  const imgHeight = useTransform([scrollYProgress, mobileMV], ([t, m]: number[]) => ctaImageSize(t, m === 1).height);
  const overlayOpacity = useTransform(scrollYProgress, [0.85, 0.95], [0, 1]);

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="dark"
      className="bg-[#F2F0EF] max-lg:!h-[150svh]"
      style={{ height: "200vh" }}
    >
      <div
        className="max-lg:!top-[35svh] max-lg:!h-[65svh]"
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
            className="font-sans text-[2.8rem] font-light leading-[1.3] xl:text-[3.5rem] max-lg:text-[clamp(1.5rem,min(7vw,9svh),2.8rem)]"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            viewport={{ once: true }}
          >
            <RevealLine><span className="text-[2rem] xl:text-[2.5rem] max-lg:text-[clamp(1.2rem,min(5.5vw,7svh),2rem)]">Be the agent</span>{" "}you&apos;re <span style={{ color: "#9E8C61", fontWeight: 500 }}>meant</span> to be</RevealLine>
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
            <span className="block font-sans text-[3.5rem] font-light text-white xl:text-[4.2rem] max-lg:text-[clamp(2.4rem,11vw,3.5rem)]">
              Be CnC
            </span>
            <MotionLink
              href="/join/apply"
              animate={PULSE_ANIMATE}
              whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
              transition={PULSE_TRANSITION}
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
