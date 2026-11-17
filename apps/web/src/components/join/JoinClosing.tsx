import { RevealLine } from "@/components/ui/reveal-text";
import { CTALineArt } from "@/components/join/CTALineArt";
import { JoinCTAButtons } from "@/components/join/JoinCTAButtons";
import { BookACallSection } from "@/components/join/BookACallSection";

// The Join page's last two sections: the "Meet with RYAN" calendar, then the final CTA.
// They share one off-white wrapper and the CTA section has no background of its own, so the
// calendar's floating shadow (which reaches past its section's bottom padding) fades into the
// CTA instead of being cut off in a hard line (Ryan, 2026-11-17). The CTA keeps `relative`
// for its line art; without a background it can't hide the shadow.
export function JoinClosing() {
  return (
    <div className="bg-[#F2F0EF]">
      {/* ── Book a call ── */}
      <BookACallSection />

      {/* ── Final CTA ── */}
      <section data-navbar-theme="light" className="relative overflow-hidden px-8 py-28 lg:px-20">
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
    </div>
  );
}
