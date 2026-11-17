import { pageMeta } from "@/lib/seo";
import { JoinHero } from "@/components/join/JoinHero";
import { StatsBar } from "@/components/join/StatsBar";
import { FounderQuote } from "@/components/join/FounderQuote";
import { WhyCnCStacked } from "@/components/join/WhyCnCStacked";
import { HowToJoin } from "@/components/join/HowToJoin";
import { JoinSteps } from "@/components/join/JoinSteps";
import { JoinClosing } from "@/components/join/JoinClosing";
import { AgentPlan } from "@/components/join/AgentPlan";

export const metadata = pageMeta("/join");


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

      {/* ── Book a call + Final CTA ── */}
      <JoinClosing />
    </main>
  );
}
