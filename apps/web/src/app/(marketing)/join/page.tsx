import Link from "next/link";
import { Metadata } from "next";
import { RevealText, RevealLine } from "@/components/ui/reveal-text";
import { DownArrow } from "@/components/ui/DownArrow";
import { StatsBar } from "@/components/join/StatsBar";
import { FounderQuote } from "@/components/join/FounderQuote";
import { WhyCnCStacked } from "@/components/join/WhyCnCStacked";
import { HowToJoin } from "@/components/join/HowToJoin";
import { JoinStepsSlider } from "@/components/join/JoinStepsSlider";
import { CTALineArt } from "@/components/join/CTALineArt";

export const metadata: Metadata = {
  title: "Join CnC Realty | Agent Opportunities",
  description: "100% commission, AI-driven CRM, and real mentorship. Join CnC Realty and build the real estate career you've always wanted.",
};


export default function JoinPage() {
  return (
    <main>
      {/* ── Hero ── */}
      <section data-navbar-theme="dark" className="relative h-[95vh] overflow-hidden bg-black">
        {/* Video — full brightness so clouds read clearly through the text */}
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover object-center"
          src="/videos/join-hero.mp4"
        />

        {/*
          SVG mask: a near-black rectangle covers the whole screen.
          The text shape is punched out (luminance=0 in the mask),
          making the overlay transparent there — revealing the video
          (and moving clouds) through the letter outlines.
        */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="be-cnc-mask">
              <rect width="1920" height="1080" fill="white" />
              <text
                x="860"
                y="400"
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="320"
                fill="black"
                style={{ fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif", fontWeight: 300 }}
              >
                Be
              </text>
              <text
                x="860"
                y="680"
                textAnchor="start"
                dominantBaseline="middle"
                fontSize="320"
                fill="black"
                style={{ fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif", fontWeight: 300 }}
              >
                CnC
              </text>
            </mask>
          </defs>
          <rect width="1920" height="1080" fill="black" fillOpacity="0.72" mask="url(#be-cnc-mask)" />
        </svg>

        <DownArrow />

      </section>

      {/* ── Light sections: stats, founder quote, why CnC ── */}
      <div data-navbar-theme="light">
        <StatsBar />
        <FounderQuote />
        <div className="bg-cnc-bg px-16 py-10">
          <div className="h-px w-full bg-[#1B1B1B]/10" />
        </div>
        <WhyCnCStacked />
      </div>

      {/* ── How to Join ── */}
      <HowToJoin />

      {/* ── Steps Slider ── */}
      <JoinStepsSlider />

      {/* ── Final CTA ── */}
      <section data-navbar-theme="light" className="relative overflow-hidden bg-[#F2F0EF] px-8 py-28 lg:px-20">
        <CTALineArt />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="mb-4 font-sans text-[2.5rem] font-light leading-tight">
            <RevealLine>Your Journey Begins <span style={{ color: "#9E8C61" }}>Here</span></RevealLine>
          </h2>
          <p className="mb-10 font-sans text-base text-[#1B1B1B]/60">
            Be CnC
          </p>
<div className="flex justify-center gap-4">
            <Link
              href="/join/agent"
              className="inline-flex items-center rounded-full bg-[#9E8C61] px-8 py-3.5 font-sans text-sm font-medium text-white transition-transform hover:scale-105"
            >
              Join
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center rounded-full border border-[#1B1B1B]/20 px-8 py-3.5 font-sans text-sm font-medium text-[#1B1B1B] transition-transform hover:scale-105"
            >
              Message
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
