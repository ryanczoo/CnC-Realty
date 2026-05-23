import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sell Your Home | CnC Realty",
  description: "List with CnC Realty and get full CRMLS exposure, expert pricing, and a dedicated agent to manage your sale from start to close.",
};

const WHY = [
  {
    title: "CRMLS Exposure",
    body: "Your listing reaches every buyer's agent in California's largest MLS the day it goes live.",
  },
  {
    title: "Expert Pricing",
    body: "We pull real comp data to price your home where it will sell — not sit.",
  },
  {
    title: "Managed End-to-End",
    body: "Photos, listing, showings, offers, escrow — your agent handles all of it so you don't have to.",
  },
  {
    title: "Fast Closings",
    body: "Our transaction management system keeps every deadline on track from offer acceptance to keys.",
  },
];

export default function SellPage() {
  return (
    <main className="min-h-screen bg-[#F2F0EF]">
      <section className="px-8 pb-24 pt-40 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 font-sans text-sm font-medium uppercase tracking-widest text-[#9E8C61]">Sell</p>
          <h1 className="mb-6 font-sans text-[3.5rem] font-light leading-tight text-[#1B1B1B] lg:text-[5rem]">
            Sell smarter,<br />close faster.
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

      <section className="border-t border-[#1B1B1B]/8 px-8 py-24 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 font-sans text-[2rem] font-light text-[#1B1B1B]">Why sell with CnC</h2>
          <div className="grid grid-cols-1 gap-px bg-[#1B1B1B]/8 md:grid-cols-2">
            {WHY.map((item) => (
              <div key={item.title} className="bg-[#F2F0EF] p-10">
                <h3 className="mb-3 font-sans text-base font-semibold uppercase tracking-wide text-[#1B1B1B]">{item.title}</h3>
                <p className="font-sans text-sm font-light leading-relaxed text-[#1B1B1B]/60">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-8 pb-24 lg:px-20">
        <div className="mx-auto max-w-5xl rounded-2xl bg-[#1B1B1B] px-10 py-14 text-center">
          <h2 className="mb-4 font-sans text-[2rem] font-light text-white">What&apos;s your home worth?</h2>
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
