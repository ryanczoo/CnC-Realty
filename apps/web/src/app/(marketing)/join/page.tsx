import Link from "next/link";
import { Metadata } from "next";
import { RevealText } from "@/components/ui/reveal-text";
import { JoinFaq } from "@/components/join/JoinFaq";
import { StatsBar } from "@/components/join/StatsBar";
import { FounderQuote } from "@/components/join/FounderQuote";
import { WhyCnCStacked } from "@/components/join/WhyCnCStacked";
import { HowToJoin } from "@/components/join/HowToJoin";
import { JoinStepsSlider } from "@/components/join/JoinStepsSlider";

export const metadata: Metadata = {
  title: "Join CnC Realty | Agent Opportunities",
  description: "100% commission, AI-driven CRM, and real mentorship. Join CnC Realty and build the real estate career you've always wanted.",
};

const FAQS = [
  {
    q: "Do I need experience to join CnC?",
    a: "No. We welcome brand-new agents into our mentorship program. Experienced agents can also transfer with a fast, straightforward process.",
  },
  {
    q: "What are the fees?",
    a: "There are no desk fees and no commission splits. You keep 100% of your commissions. The only cost is your California DRE license fee, paid directly to the state.",
  },
  {
    q: "How do I get started?",
    a: "Click \"Start Your Application\", fill out the agent onboarding form, and a member of our team will reach out within 24 hours to complete your transfer.",
  },
  {
    q: "Can I join if I'm already with another brokerage?",
    a: "Yes. License transfers in California are straightforward. We'll walk you through every step of the process.",
  },
  {
    q: "What technology do CnC agents get?",
    a: "Every agent gets access to our AI-driven CRM with lead tracking, automated follow-ups, transaction management, and marketing campaign tools — all built in-house for CnC.",
  },
];

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

        <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-4">
          <Link
            href="/join/agent"
            className="inline-flex items-center rounded-full bg-[#9E8C61] px-8 py-3.5 font-sans text-sm font-medium text-white transition-transform hover:scale-105"
          >
            Apply
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 px-8 py-3.5 font-sans text-sm font-medium text-white transition-transform hover:scale-105"
          >
            Message
          </Link>
        </div>

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

      {/* ── FAQ ── */}
      <section data-navbar-theme="dark" className="bg-[#0f0f0f] px-8 py-28 lg:px-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 font-sans text-xs font-medium uppercase tracking-widest text-[#9E8C61]">Got questions?</p>
          <h2 className="mb-12 font-sans text-[2rem] font-light"><RevealText onDark>Common questions</RevealText></h2>
          <JoinFaq faqs={FAQS} />
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section data-navbar-theme="dark" className="bg-[#9E8C61] px-8 py-28 lg:px-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 font-sans text-[2.5rem] font-light leading-tight">
            <RevealText onDark>Ready to make the move?</RevealText>
          </h2>
          <p className="mb-2 font-sans text-base text-white/70">
            Instant guaranteed approval for all licensed California agents.
          </p>
          <p className="mb-10 font-sans text-sm text-white/50">Together, we are CnC.</p>
          <Link
            href="/join/agent"
            className="inline-flex rounded-full bg-white px-8 py-3.5 font-sans text-sm font-medium text-[#9E8C61] transition-opacity hover:opacity-90"
          >
            Start Your Application →
          </Link>
        </div>
      </section>
    </main>
  );
}
