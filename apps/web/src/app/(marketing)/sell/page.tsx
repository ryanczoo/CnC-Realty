import { Metadata } from "next";
import { SellProcess } from "@/components/sell/SellProcess";
import { PageCTA } from "@/components/ui/PageCTA";
import { DownArrow } from "@/components/ui/DownArrow";

export const metadata: Metadata = {
  title: "Sell Your Home | CnC Realty",
  description: "List with CnC Realty and get full CRMLS exposure, expert pricing, and a dedicated agent to manage your sale from start to close.",
};

export default function SellPage() {
  return (
    <main>
      {/* ── Hero ── */}
      <section data-navbar-theme="dark" className="relative h-[95vh] overflow-hidden bg-black">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover object-center"
          src="/videos/sell-hero.mp4"
        />

        {/*
          SVG mask: near-black rectangle covers the whole screen.
          The text shapes are punched out (fill="black" in mask),
          revealing the video through the letter outlines.
        */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="sell-hero-mask">
              <rect width="1920" height="1080" fill="white" />
              <text
                x="960"
                y="400"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="240"
                fill="black"
                style={{ fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif", fontWeight: 300 }}
              >
                SELL WITH
              </text>
              <text
                x="960"
                y="710"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="320"
                fill="black"
                style={{ fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif", fontWeight: 300 }}
              >
                US
              </text>
            </mask>
          </defs>
          <rect width="1920" height="1080" fill="black" fillOpacity="0.72" mask="url(#sell-hero-mask)" />
        </svg>

        <DownArrow />
      </section>

      {/* ── Light sections ── */}
      <div data-navbar-theme="light" className="bg-[#F2F0EF]">
        <SellProcess />
        <PageCTA
          heading={<>What&apos;s your home <span style={{ color: "#9E8C61" }}>worth?</span></>}
          body="Get a free, no-obligation valuation from a CnC agent."
          primaryHref="/contact"
          primaryLabel="Request a Valuation →"
          secondaryHref="/agents"
          secondaryLabel="Meet Our Agents"
        />
      </div>
    </main>
  );
}
