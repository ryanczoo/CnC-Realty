import Link from "next/link";
import { Metadata } from "next";
import { RevealText } from "@/components/ui/reveal-text";
import { PageCTA } from "@/components/ui/PageCTA";
import { BuySteps } from "@/components/buy/BuySteps";

export const metadata: Metadata = {
  title: "Buy a Home | CnC Realty",
  description: "Search thousands of California homes with CnC Realty. Expert buyer's agents, live MLS listings, and zero pressure.",
};

export default function BuyPage() {
  return (
    <main data-navbar-theme="light" className="min-h-screen bg-[#F2F0EF]">
      {/* Hero */}
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

      {/* Steps — replaces "How it Works" grid */}
      <BuySteps />

      <PageCTA
        heading={<>Ready to start <span className="text-cnc-gold">looking?</span></>}
        body="Browse live CRMLS listings — no account required."
        primaryHref="/properties"
        primaryLabel="Search All Listings →"
        secondaryHref="/agents"
        secondaryLabel="Find an Agent"
      />
    </main>
  );
}
