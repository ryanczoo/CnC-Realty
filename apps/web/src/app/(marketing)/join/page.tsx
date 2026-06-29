import { Metadata } from "next";
import { RevealLine } from "@/components/ui/reveal-text";
import { JoinHero } from "@/components/join/JoinHero";
import { StatsBar } from "@/components/join/StatsBar";
import { FounderQuote } from "@/components/join/FounderQuote";
import { WhyCnCStacked } from "@/components/join/WhyCnCStacked";
import { HowToJoin } from "@/components/join/HowToJoin";
import { JoinSteps } from "@/components/join/JoinSteps";
import { CTALineArt } from "@/components/join/CTALineArt";
import { JoinCTAButtons } from "@/components/join/JoinCTAButtons";
import { AgentPlan } from "@/components/join/AgentPlan";

export const metadata: Metadata = {
  title: "Join CnC Realty | Agent Opportunities",
  description: "100% commission, AI-driven CRM, and real mentorship. Join CnC Realty and build the real estate career you've always wanted.",
};


export default function JoinPage() {
  return (
    <main>
      <JoinHero />

      {/* ── Light sections: stats, founder quote, why CnC ── */}
      <div data-navbar-theme="light">
        <StatsBar />
        <FounderQuote />
        <WhyCnCStacked />
      </div>

      {/* ── Agent Plan ── */}
      <AgentPlan />

      {/* ── Steps Slider ── */}
      <JoinSteps />

      {/* ── How to Join ── */}
      <HowToJoin />

      {/* ── Final CTA ── */}
      <section data-navbar-theme="light" className="relative overflow-hidden bg-[#F2F0EF] px-8 py-28 lg:px-20">
        <CTALineArt />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="mb-4 font-sans text-[2.5rem] font-light leading-tight">
            <RevealLine>Your Journey Begins <span style={{ color: "#9E8C61", fontWeight: 500 }}>Here</span></RevealLine>
          </h2>
          <p className="mb-10 font-sans text-base text-[#1B1B1B]/60">
            Be CnC
          </p>
<JoinCTAButtons />
        </div>
      </section>
    </main>
  );
}
