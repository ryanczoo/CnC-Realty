import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rent | CnC Realty",
  description: "Find your next rental in California with CnC Realty. Live CRMLS lease listings with expert tenant representation.",
};

const PERKS = [
  {
    title: "Live Rental Listings",
    body: "CRMLS updates every 15 minutes — see new rentals the moment they hit the market before anyone else.",
  },
  {
    title: "Tenant Representation",
    body: "Your agent represents your interests — not the landlord's. We negotiate terms, review leases, and fight for the best deal.",
  },
  {
    title: "California Market Experts",
    body: "SoCal rental markets move fast. Our agents know which neighborhoods, buildings, and landlords to prioritize.",
  },
];

export default function RentPage() {
  return (
    <main className="min-h-screen bg-[#F2F0EF]">
      <section className="px-8 pb-24 pt-40 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 font-sans text-sm font-medium uppercase tracking-widest text-[#9E8C61]">Rent</p>
          <h1 className="mb-6 font-sans text-[3.5rem] font-light leading-tight text-[#1B1B1B] lg:text-[5rem]">
            Find the right<br />place to live.
          </h1>
          <p className="mb-10 max-w-xl font-sans text-lg font-light text-[#1B1B1B]/60">
            Live CRMLS rental listings across Southern California. Expert tenant representation at no cost to you.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/properties?listingType=FOR_LEASE"
              className="inline-flex items-center gap-2 rounded-full bg-[#1B1B1B] px-8 py-3.5 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80"
            >
              Browse Rentals →
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-[#1B1B1B]/20 px-8 py-3.5 font-sans text-sm font-medium text-[#1B1B1B] transition-colors hover:border-[#1B1B1B]/50"
            >
              Talk to an Agent
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-[#1B1B1B]/8 px-8 py-24 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 font-sans text-[2rem] font-light text-[#1B1B1B]">Why rent with CnC</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {PERKS.map((item) => (
              <div key={item.title} className="rounded-xl border border-[#1B1B1B]/8 bg-white p-8">
                <h3 className="mb-3 font-sans text-base font-semibold text-[#1B1B1B]">{item.title}</h3>
                <p className="font-sans text-sm font-light leading-relaxed text-[#1B1B1B]/60">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-8 pb-24 lg:px-20">
        <div className="mx-auto max-w-5xl rounded-2xl bg-[#1B1B1B] px-10 py-14 text-center">
          <h2 className="mb-4 font-sans text-[2rem] font-light text-white">Need help finding a rental?</h2>
          <p className="mb-8 font-sans text-base text-white/50">A CnC agent will work on your behalf — at no cost to you.</p>
          <Link
            href="/contact"
            className="inline-flex rounded-full bg-[#9E8C61] px-8 py-3.5 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            Get in Touch →
          </Link>
        </div>
      </section>
    </main>
  );
}
