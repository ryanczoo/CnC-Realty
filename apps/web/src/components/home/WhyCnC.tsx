"use client";

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "motion/react";
import { useRef, useState } from "react";

const ITEMS: { title: TitlePart[]; description: string; imgFront?: string; imgFrontPosition?: string; imgBack?: string; videoBack?: string; videoBackPosition?: string; showButton?: boolean }[] = [
  {
    title: [{ text: "100%" }, { text: "COMMISSION", sm: true }],
    description:
      "No jokes, no surprises. Keep every dollar you earn from every sale because you deserve it. Plain and simple.",
    videoBack: "/videos/commission-back.mp4",
    videoBackPosition: "75% center",
    imgFront: "/images/commission-front.jpg",
    imgFrontPosition: "center center",
  },
  {
    title: [{ text: "AI-DRIVEN TECH" }],
    description:
      "Predictive lead scoring, automated follow-ups, and real-time market insights powered by AI. Combined with our custom CRM integrated software to provide you with all the tools to succeed.",
    videoBack: "/videos/ai-tech-back.mp4",
    imgFront: "/images/ai-tech-front.jpg",
  },
  {
    title: [{ text: "TRAINING &" }, { text: "MENTORSHIP", sm: true }],
    description:
      "24/7 access to seasoned agents, updated video guides, custom roadmaps for success, and much more. New agents receive a mentor to help them with every step of the way.",
    videoBack: "/videos/training-back.mp4",
    imgFront: "/images/training-front.jpg",
  },
  {
    title: [{ text: "FREEDOM AWAITS" }],
    description:
      "Create a personal brand, build your own team, and grow at your pace - backed by CnC Realty to give you everything you need and nothing you don't.",
    videoBack: "/videos/freedom-back.mp4",
    imgFront: "/images/freedom-front.jpg",
    imgFrontPosition: "center 40%",
    showButton: true,
  },
];

type TitlePart = { text: string; sm?: boolean };

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
  const [activeIdx, setActiveIdx] = useState(0);
  const lastIdxRef = useRef(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const fillPct = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const next = Math.min(Math.floor(latest * ITEMS.length), ITEMS.length - 1);
    if (next !== lastIdxRef.current) {
      lastIdxRef.current = next;
      setActiveIdx(next);
    }
  });

  const active = ITEMS[activeIdx];

  return (
    <div
      ref={containerRef}
      style={{ height: `${ITEMS.length * 100}vh` }}
      className="relative"
    >
      <div className="sticky top-0 h-screen overflow-hidden bg-[#F2F0EF]">
        <div className="flex h-full">

          {/* Left: text panel */}
          <div className="relative flex w-[42%] flex-col justify-center pl-28 pr-16">
            {/* Pill-shaped scroll progress indicator */}
            <div
              className="absolute left-14 top-1/2 -translate-y-1/2"
              style={{ width: 20, height: 220 }}
            >
              {/* Track — full height, always visible */}
              <div className="absolute left-1/2 top-0 h-full w-[1px] -translate-x-1/2 rounded-full bg-[#1B1B1B]/20" />
              {/* Fill — grows with scroll */}
              <div className="absolute inset-0 overflow-hidden rounded-full">
                <motion.div
                  className="absolute left-1/2 top-0 w-[3px] -translate-x-1/2 rounded-full bg-[#1B1B1B]"
                  style={{ height: fillPct }}
                />
              </div>
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
                <motion.h2
                  className="font-sans font-light uppercase leading-[0.90] tracking-wide text-[#1B1B1B]"
                  variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.1 } },
                  }}
                >
                  {active.title.map((part, i) => (
                    <span
                      key={i}
                      className={`block ${part.sm ? "text-[3rem] xl:text-[3.6rem]" : "text-[4rem] xl:text-[4.8rem]"}`}
                    >
                      {part.text.split(" ").map((word, j) => (
                        <motion.span
                          key={j}
                          className="mr-[0.22em] inline-block"
                          variants={{
                            hidden: { opacity: 0, x: -16 },
                            visible: { opacity: 1, x: 0, transition: { duration: 0.55, ease: "easeOut" } },
                          }}
                        >
                          {word}
                        </motion.span>
                      ))}
                    </span>
                  ))}
                </motion.h2>

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
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
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
              className="absolute overflow-hidden"
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

            {/* Front image — fade up */}
            <AnimatePresence>
              <motion.div
                key={`front-${activeIdx}`}
                className="absolute z-10 overflow-hidden"
                style={{ left: "2%", top: "25%", width: "40%", height: "52%" }}
                initial={{ opacity: 0, y: 36 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.65, ease: "easeOut", delay: 0.18 }}
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
