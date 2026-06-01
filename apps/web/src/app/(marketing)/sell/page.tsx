import Link from "next/link";
import { Metadata } from "next";
import { RevealText } from "@/components/ui/reveal-text";
import { SellProcess } from "@/components/sell/SellProcess";

export const metadata: Metadata = {
  title: "Sell Your Home | CnC Realty",
  description: "List with CnC Realty and get full CRMLS exposure, expert pricing, and a dedicated agent to manage your sale from start to close.",
};

export default function SellPage() {
  return (
    <main data-navbar-theme="light" className="min-h-screen bg-[#F2F0EF]">
      <section className="px-8 pb-24 pt-40 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 font-sans text-sm font-medium uppercase tracking-widest text-[#9E8C61]">Sell</p>
          <h1 className="mb-6 font-sans text-[3.5rem] font-light leading-tight lg:text-[5rem]">
            <span className="block"><RevealText>Sell smarter,</RevealText></span>
            <span className="block"><RevealText delay={0.15}>close faster.</RevealText></span>
          </h1>
          <p className="mb-10 max-w-xl font-sans text-lg font-light text-[#1B1B1B]/60">
            Full CRMLS exposure. Expert pricing. A dedicated agent from listing day through closing day.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full bg-[#1B1B1B] px-8 py-3.5 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            Get a Free Home Valuation →
          </Link>
        </div>
      </section>

      <SellProcess />

      <section className="px-8 pb-24 pt-16 lg:px-20">
        <div className="mx-auto max-w-5xl rounded-2xl bg-[#1B1B1B] px-10 py-14 text-center">
          <h2 className="mb-4 font-sans text-[2rem] font-light"><RevealText onDark>What&apos;s your home worth?</RevealText></h2>
          <p className="mb-8 font-sans text-base text-white/50">Get a free, no-obligation valuation from a CnC agent.</p>
          <Link
            href="/contact"
            className="inline-flex rounded-full bg-[#9E8C61] px-8 py-3.5 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            Request a Valuation →
          </Link>
        </div>
      </section>
    </main>
  );
}
