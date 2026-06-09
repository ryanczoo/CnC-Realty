import { Metadata } from "next";
import { RentHero } from "@/components/rent/RentHero";
import { RevealText } from "@/components/ui/reveal-text";
import { PageCTA } from "@/components/ui/PageCTA";

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
      <RentHero />

      <section className="border-t border-[#1B1B1B]/8 px-8 py-24 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 font-sans text-[2rem] font-light"><RevealText>Why rent with CnC</RevealText></h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {PERKS.map((item) => (
              <div key={item.title} className="rounded-xl border border-[#1B1B1B]/8 bg-cnc-bg p-8">
                <h3 className="mb-3 font-sans text-base font-semibold text-[#1B1B1B]">{item.title}</h3>
                <p className="font-sans text-sm font-light leading-relaxed text-[#1B1B1B]/60">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PageCTA
        heading={<>Need help finding a <span className="text-cnc-gold">rental?</span></>}
        body="A CnC agent will work on your behalf — at no cost to you."
        primaryHref="/properties?listingType=FOR_LEASE"
        primaryLabel="Browse Rentals →"
        secondaryHref="/contact"
        secondaryLabel="Talk to an Agent"
      />
    </main>
  );
}
