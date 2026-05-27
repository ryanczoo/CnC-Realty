"use client";

import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PHRASES = [
  "Find Your Dream Home",
  "Start Your Search",
  "Your Future Begins Here",
  "Join CnC",
];

const LONGEST_PHRASE = PHRASES.reduce((a, b) => (b.length > a.length ? b : a));
const PHRASE_WORDS = PHRASES.map((p) => p.split(" "));

const SEARCH_PLACEHOLDERS = [
  'Search by city, zip, or address…',
  'Try "Los Angeles, CA"',
  'Try "90210"',
  'Try "3 bed homes in Pasadena"',
];

const VIDEO_START = 6;
const VIDEO_END = 22;

const noop = () => {};

export function HeroSection() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % PHRASES.length), 5000);
    return () => clearInterval(id);
  }, []);

  const handleCanPlay = () => {
    const v = videoRef.current;
    if (v && v.currentTime < VIDEO_START) v.currentTime = VIDEO_START;
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime >= VIDEO_END) v.currentTime = VIDEO_START;
  };

  return (
    <section data-navbar-theme="dark" className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        src="/homepage-video.mp4"
        onCanPlay={handleCanPlay}
        onTimeUpdate={handleTimeUpdate}
      />
      <div className="absolute inset-0 bg-black/65" />

      <div className="relative z-10 flex flex-col items-center gap-6 px-4 text-center mt-72">
        {/*
          Invisible spacer sized to LONGEST_PHRASE forces the container width
          to stay constant regardless of which phrase is active. The search
          bar (w-full) then matches that fixed width exactly.
        */}
        <div className="mx-auto flex flex-col items-stretch gap-6" style={{ width: "max-content", maxWidth: "calc(100vw - 2rem)" }}>
          {/* Zero-height spacer — holds the width of the longest phrase */}
          <span
            aria-hidden="true"
            className="block whitespace-nowrap font-chopin text-3xl font-bold opacity-0 md:text-4xl lg:text-5xl"
            style={{ height: 0, lineHeight: 0, overflow: "hidden" }}
          >
            {LONGEST_PHRASE}
          </span>

          <div className="flex h-14 w-full items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.h1
                key={phraseIdx}
                className="flex flex-wrap justify-center gap-x-[0.3em] font-chopin text-3xl font-bold text-white md:text-4xl lg:text-5xl"
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, transition: { duration: 0.25, ease: "easeIn" } }}
                variants={{ visible: { transition: { staggerChildren: 0.28 } } }}
              >
                {PHRASE_WORDS[phraseIdx].map((word, i, arr) => (
                  <motion.span
                    key={i}
                    className="inline-block whitespace-nowrap"
                    style={i === arr.length - 1 ? { color: "#9E8C61" } : undefined}
                    variants={{
                      hidden: { opacity: 0, x: -14 },
                      visible: { opacity: 1, x: 0, transition: { duration: 0.9, ease: "easeOut" } },
                    }}
                  >
                    {word}
                  </motion.span>
                ))}
              </motion.h1>
            </AnimatePresence>
          </div>

          <PlaceholdersAndVanishInput
            placeholders={SEARCH_PLACEHOLDERS}
            onChange={noop}
            onSubmit={(e) => {
              const input = (e.currentTarget as HTMLFormElement).querySelector(
                "input"
              ) as HTMLInputElement;
              if (input?.value) {
                router.push(`/properties?query=${encodeURIComponent(input.value)}`);
              }
            }}
          />
        </div>

      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50"
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 30 30"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M16 20.488c0-.13.053-.253.146-.344l13-13.002c.42-.44 1.174.24.706.707l-13 13c-.302.31-.853.096-.853-.362zM.852 7.142l14 14.002c.447.447-.273 1.16-.707.707l-14-14c-.444-.445.26-1.155.707-.708z" />
        </svg>
      </motion.div>
    </section>
  );
}
