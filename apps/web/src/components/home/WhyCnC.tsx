"use client";

import { AnimatePresence, motion, useScroll } from "motion/react";
import { useRef } from "react";
import { useScrollStepper } from "@/hooks/useScrollStepper";
import { SPRING_HOVER, PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";
import { RevealLine } from "@/components/ui/reveal-text";

const ITEMS: { title: TitlePart[]; description: string; imgFront?: string; imgFrontPosition?: string; imgBack?: string; videoBack?: string; videoBackPosition?: string; showButton?: boolean }[] = [
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
    title: [{ text: "AI-DRIVEN", sm: true }, { text: "TECH" }],
    description:
      "Predictive lead scoring, automated transaction alerts, creative email campaigns, real-time marketing analysis all powered by AI and FREE for CnC Agents. Combined with our custom CRM software, you have all the tools to succeed.",
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

const N_STRIPS = 8;

// Isolated so AnimatePresence freezes the imgSrc prop on exit
function ShutterImage({ imgSrc }: { imgSrc: string }) {
  return (
    <motion.div
      className="absolute inset-0"
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.045 } },
      }}
    >
      {Array.from({ length: N_STRIPS }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-full overflow-hidden"
          style={{
            top: `${(i / N_STRIPS) * 100}%`,
            height: `${100 / N_STRIPS}%`,
            transformOrigin: "top center",
          }}
          variants={{
            hidden: { scaleY: 0 },
            visible: {
              scaleY: 1,
              transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] },
            },
          }}
        >
          <img
            src={imgSrc}
            alt=""
            style={{
              position: "absolute",
              top: `-${i * 100}%`,
              width: "100%",
              height: `${N_STRIPS * 100}%`,
              objectFit: "cover",
            }}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

export function WhyCnC() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const { activeIdx, scrollDirRef, barWidths } = useScrollStepper(scrollYProgress, ITEMS.length);

  const active = ITEMS[activeIdx];

  return (
    <div
      data-navbar-theme="light"
      ref={containerRef}
      style={{ height: `${ITEMS.length * 100}vh` }}
      className="relative"
    >
      <div className="sticky top-0 h-screen overflow-hidden bg-[#F2F0EF]">
        <div className="flex h-full">

          {/* Left: text panel */}
          <div className="relative flex w-[42%] flex-col justify-center pl-28 pr-16">
            {/* Segmented vertical progress — 4 equal segments, each fills top-to-bottom */}
            <div
              className="absolute left-14 top-1/2 flex -translate-y-1/2 flex-col gap-1"
              style={{ width: 2, height: 220 }}
            >
              {ITEMS.map((_, i) => (
                <div
                  key={i}
                  className="flex-1 overflow-hidden"
                  style={{ backgroundColor: "rgba(27,27,27,0.12)" }}
                >
                  <div
                    className="w-full bg-[#1B1B1B]"
                    style={{ height: `${barWidths[i]}%`, transition: "height 0.05s linear" }}
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
                className="flex flex-col gap-12"
              >
                <h2 className="font-sans font-light uppercase leading-[0.90] tracking-wide text-[#1B1B1B]">
                  {active.title.map((part, i) => {
                    const isLastPart = i === active.title.length - 1;
                    return (
                      <span
                        key={i}
                        className={`block ${part.size ?? (part.sm ? "text-[3rem] xl:text-[3.6rem]" : "text-[4rem] xl:text-[4.8rem]")}`}
                      >
                        <RevealLine triggerOnMount delay={i * 0.15}>
                          <span className={isLastPart ? "text-cnc-gold" : undefined}>
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
                  <motion.a
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
                  </motion.a>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: overlapping images */}
          <div className="relative flex-1">

            {/* Back media — venetian blind for images, crossfade for video */}
            <div
              className="absolute overflow-hidden rounded-2xl"
              style={{ right: "12%", top: "13%", width: "60%", height: "80%" }}
            >
              <AnimatePresence>
                {active.videoBack ? (
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
                ) : (
                  <ShutterImage
                    key={`back-${activeIdx}`}
                    imgSrc={active.imgBack ?? ""}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Front image — scroll-direction wipe */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`front-${activeIdx}`}
                className="absolute z-10 overflow-hidden rounded-2xl"
                style={{ left: "2%", top: "25%", width: "40%", height: "52%" }}
                initial={{ clipPath: scrollDirRef.current === "down" ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)" }}
                animate={{ clipPath: "inset(0 0 0 0)" }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <img
                  src={active.imgFront ?? ""}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{ objectPosition: active.imgFrontPosition ?? "center" }}
                />
              </motion.div>
            </AnimatePresence>

          </div>
        </div>
      </div>
    </div>
  );
}
