"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useScroll } from "motion/react";
import { useRef } from "react";
import { useScrollStepper } from "@/hooks/useScrollStepper";
import { SPRING_HOVER, PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";
import { RevealLine } from "@/components/ui/reveal-text";

const MotionLink = motion(Link);

const ITEMS: { title: TitlePart[]; description: string; imgFront?: string; imgFrontPosition?: string; videoBack?: string; videoBackPosition?: string; showButton?: boolean }[] = [
  {
    title: [{ text: "100%", sm: true }, { text: "COMMISSION", size: "text-[3.4rem] xl:text-[4.1rem]" }],
    description:
      "No jokes, no surprises. Keep every dollar you earn from every sale because you deserve it. Plain and simple.",
    videoBack: "/videos/commission-back.mp4",
    videoBackPosition: "75% center",
    imgFront: "/images/commission-front.jpg",
    imgFrontPosition: "center center",
  },
  {
    title: [{ text: "AI", sm: true }, { text: "TECH" }],
    description:
      "Predictive lead scoring, automated transaction alerts, creative email campaigns, real-time marketing analysis all powered by AI. Combined with our custom CRM software, you have all the tools to succeed.",
    videoBack: "/videos/ai-tech-back.mp4",
    imgFront: "/images/ai-tech-front.jpg",
  },
  {
    title: [{ text: "TRAINING &", sm: true }, { text: "MENTORSHIP" }],
    description:
      "24/7 access to seasoned agents, updated video guides, custom roadmaps for success, and much more. New agents receive a mentor to help them with every step of the way.",
    videoBack: "/videos/training-back.mp4",
    imgFront: "/images/training-front.jpg",
  },
  {
    title: [{ text: "FREEDOM", sm: true }, { text: "AWAITS" }],
    description:
      "Create a personal brand, build your own team, and grow at your pace - backed by CnC Realty to give you everything you need and nothing you don't.",
    videoBack: "/videos/freedom-back.mp4",
    imgFront: "/images/freedom-front.jpg",
    imgFrontPosition: "center 40%",
    showButton: true,
  },
];

type TitlePart = { text: string; sm?: boolean; size?: string };

export function WhyCnC() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const { activeIdx, scrollDirRef, registerBarEl } = useScrollStepper(scrollYProgress, ITEMS.length);

  const active = ITEMS[activeIdx];

  return (
    <div
      data-navbar-theme="light"
      ref={containerRef}
      style={{ height: `${ITEMS.length * 100}vh` }}
      className="relative max-lg:!h-[200svh] max-lg:bg-[#F2F0EF]"
    >
      <div className="sticky top-0 h-screen overflow-hidden bg-[#F2F0EF] max-lg:h-[100svh]">
        <div className="flex h-full max-lg:portrait:flex-col">

          {/* Left: text panel */}
          <div className="relative flex w-[42%] flex-col justify-center pl-28 pr-16 max-lg:portrait:w-full max-lg:portrait:flex-1 max-lg:portrait:justify-start max-lg:portrait:pb-8 max-lg:portrait:pl-14 max-lg:portrait:pr-6 max-lg:portrait:pt-6 max-lg:landscape:pl-14 max-lg:landscape:pr-6">
            {/* Segmented vertical progress — 4 equal segments, each fills top-to-bottom */}
            <div
              className="absolute left-14 top-1/2 flex -translate-y-1/2 flex-col gap-1 max-lg:left-6 max-lg:!h-[120px] max-lg:portrait:top-6 max-lg:portrait:translate-y-0"
              style={{ width: 2, height: 220 }}
            >
              {ITEMS.map((_, i) => (
                <div
                  key={i}
                  className="flex-1 overflow-hidden"
                  style={{ backgroundColor: "rgba(27,27,27,0.12)" }}
                >
                  <div
                    ref={(el) => registerBarEl(i, el)}
                    className="w-full bg-[#1B1B1B]"
                    style={{ height: "0%", transition: "height 0.05s linear" }}
                  />
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeIdx}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -44, transition: { duration: 0.4, ease: "easeIn" } }}
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.18 } },
                }}
                className="flex flex-col gap-12 max-lg:gap-5"
              >
                <h2 className="font-sans font-light uppercase leading-[0.90] tracking-wide text-[#1B1B1B]">
                  {active.title.map((part, i) => {
                    const isLastPart = i === active.title.length - 1;
                    return (
                      <span
                        key={i}
                        className={`block ${part.size ?? (part.sm ? "text-[3rem] xl:text-[3.6rem]" : "text-[4rem] xl:text-[4.8rem]")} ${part.sm ? "max-lg:text-[clamp(1.2rem,min(7vw,6svh),2.8rem)]" : "max-lg:text-[clamp(1.5rem,min(9vw,8svh),3.6rem)]"}`}
                      >
                        <RevealLine triggerOnMount delay={i * 0.15}>
                          <span className={isLastPart ? "text-cnc-gold font-medium" : undefined}>
                            {part.text}
                          </span>
                        </RevealLine>
                      </span>
                    );
                  })}
                </h2>

                <motion.p
                  className="max-w-sm text-[0.95rem] leading-relaxed text-[#1B1B1B]/60"
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
                  }}
                >
                  {active.description}
                </motion.p>

                {active.showButton && (
                  <MotionLink
                    href="/join"
                    animate={PULSE_ANIMATE}
                    whileHover={{ scale: 1.1, transition: SPRING_HOVER }}
                    transition={PULSE_TRANSITION}
                    className="flex w-fit items-center gap-3 rounded-full bg-[#1B1B1B] px-7 py-3.5 text-sm font-medium text-white"
                    variants={{
                      hidden: { opacity: 0, y: 14 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
                    }}
                  >
                    Join CnC
                  </MotionLink>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: overlapping images */}
          <div className="relative flex-1 max-lg:portrait:h-[45%] max-lg:portrait:flex-none">

            {/* Back media — venetian blind for images, crossfade for video */}
            <div
              className="absolute overflow-hidden rounded-2xl max-lg:portrait:!right-[6%] max-lg:portrait:!top-[10%] max-lg:portrait:!h-[82%] max-lg:portrait:!w-[62%]"
              style={{ right: "12%", top: "13%", width: "60%", height: "80%" }}
            >
              <AnimatePresence>
                {active.videoBack && (
                  <motion.video
                    key={`back-${activeIdx}`}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ objectPosition: active.videoBackPosition ?? "center" }}
                    src={active.videoBack}
                    autoPlay
                    muted
                    loop
                    playsInline
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Invisible copies of every front image, at the same box size and
                `sizes` as the real one below, so the browser fetches the exact
                same optimized files as the section scrolls near. When a panel's
                wipe mounts its image it comes straight from cache instead of
                the wipe sweeping over an empty box while it downloads. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute opacity-0 max-lg:portrait:!left-[6%] max-lg:portrait:!top-[20%] max-lg:portrait:!h-[62%] max-lg:portrait:!w-[44%]"
              style={{ left: "2%", top: "25%", width: "40%", height: "52%" }}
            >
              {ITEMS.map((item) =>
                item.imgFront ? (
                  <Image key={item.imgFront} src={item.imgFront} alt="" fill className="object-cover" sizes="40vw" />
                ) : null
              )}
            </div>

            {/* Front image — scroll-direction wipe */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`front-${activeIdx}`}
                className="absolute z-10 overflow-hidden rounded-2xl max-lg:portrait:!left-[6%] max-lg:portrait:!top-[20%] max-lg:portrait:!h-[62%] max-lg:portrait:!w-[44%]"
                style={{ left: "2%", top: "25%", width: "40%", height: "52%" }}
                initial={{ clipPath: scrollDirRef.current === "down" ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)" }}
                animate={{ clipPath: "inset(0 0 0 0)" }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
              >
                {active.imgFront && (
                  <Image
                    src={active.imgFront}
                    alt=""
                    fill
                    className="object-cover"
                    style={{ objectPosition: active.imgFrontPosition ?? "center" }}
                    sizes="40vw"
                  />
                )}
              </motion.div>
            </AnimatePresence>

          </div>
        </div>
      </div>
    </div>
  );
}
