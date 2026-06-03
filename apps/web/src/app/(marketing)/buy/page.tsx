import Link from "next/link";
import { Metadata } from "next";
import { RevealText } from "@/components/ui/reveal-text";
import { PageCTA } from "@/components/ui/PageCTA";

export const metadata: Metadata = {
  title: "Buy a Home | CnC Realty",
  description: "Search thousands of California homes with CnC Realty. Expert buyer's agents, live MLS listings, and zero pressure.",
};

const STEPS = [
  {
    number: "01",
    title: "Get Pre-Approved",
    body: "Connect with a lender to understand your budget before you fall in love with a home. Our agents can refer you to trusted local lenders.",
  },
  {
    number: "02",
    title: "Find Your Agent",
    body: "Every CnC agent is a local California expert. Match with someone who knows your target neighborhoods inside and out.",
  },
  {
    number: "03",
    title: "Search & Tour",
    body: "Browse live CRMLS listings updated every 15 minutes. Schedule tours directly and move fast when the right home appears.",
  },
  {
    number: "04",
    title: "Close with Confidence",
    body: "From offer to keys, your CnC agent handles the contracts, negotiations, inspections, and escrow — so you can focus on the move.",
  },
];

export default function BuyPage() {
  return (
    <main data-navbar-theme="light" className="min-h-screen bg-[#F2F0EF]">
      <section className="px-8 pb-24 pt-40 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 font-sans text-sm font-medium uppercase tracking-widest text-[#9E8C61]">Buy</p>
          <h1 className="mb-6 font-sans text-[3.5rem] font-light leading-tight lg:text-[5rem]">
            <span className="block"><RevealText>Find your</RevealText></span>
            <span className="block"><RevealText delay={0.15}>next home.</RevealText></span>
          </h1>
          <p className="mb-10 max-w-xl font-sans text-lg font-light text-[#1B1B1B]/60">
            Thousands of California listings updated directly from CRMLS. Expert agents. Zero pressure.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/properties"
              className="inline-flex items-center gap-2 rounded-full bg-[#1B1B1B] px-8 py-3.5 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80"
            >
              Search Listings →
            </Link>
            <Link
              href="/agents"
              className="inline-flex items-center gap-2 rounded-full border border-[#1B1B1B]/20 px-8 py-3.5 font-sans text-sm font-medium text-[#1B1B1B] transition-colors hover:border-[#1B1B1B]/50"
            >
              Find an Agent
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-[#1B1B1B]/8 px-8 py-24 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 font-sans text-[2rem] font-light"><RevealText>How it works</RevealText></h2>
          <div className="grid grid-cols-1 gap-px bg-[#1B1B1B]/8 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.number} className="bg-[#F2F0EF] p-8">
                <p className="mb-4 font-sans text-xs font-medium text-[#9E8C61]">{step.number}</p>
                <h3 className="mb-3 font-sans text-lg font-medium text-[#1B1B1B]">{step.title}</h3>
                <p className="font-sans text-sm font-light leading-relaxed text-[#1B1B1B]/60">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PageCTA
        heading={<>Ready to start <span style={{ color: "#9E8C61" }}>looking?</span></>}
        body="Browse live CRMLS listings — no account required."
        primaryHref="/properties"
        primaryLabel="Search All Listings →"
        secondaryHref="/agents"
        secondaryLabel="Find an Agent"
      />
    </main>
  );
}
