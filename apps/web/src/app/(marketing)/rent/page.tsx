import { Metadata } from "next";
import { RentHero } from "@/components/rent/RentHero";
import { RentSteps } from "@/components/rent/RentSteps";
import { RentCitiesSlider } from "@/components/rent/RentCitiesSlider";
import { FAQ } from "@/components/home/FAQ";
import { GradientBridge } from "@/components/ui/GradientBridge";
import { PageCTA } from "@/components/ui/PageCTA";

export const metadata: Metadata = {
  title: "Rent | CnC Realty",
  description: "Find your next rental in California with CnC Realty. Live CRMLS lease listings with expert tenant representation.",
};

const RENT_FAQS = [
  {
    question: "DO I NEED AN AGENT TO RENT A HOME?",
    answer:
      "You don't have to, but having a CnC agent on your side is completely free as a tenant — our commission is paid by the landlord. We'll help you find the right home faster, negotiate lease terms, and protect your interests throughout the process.",
  },
  {
    question: "HOW LONG DOES IT TAKE TO FIND A RENTAL?",
    answer:
      "It depends on the market and your requirements, but most of our clients find and secure a rental within 2–4 weeks. Having a CnC agent speeds up the process significantly — we have access to every active CRMLS listing and can get you in the door fast.",
  },
  {
    question: "WHAT DO I NEED TO QUALIFY AS A RENTER?",
    answer:
      "Most landlords in California require proof of income (typically 2.5–3× the monthly rent), a credit check, rental history, and references. Your CnC agent will walk you through exactly what each landlord is looking for and help you put together a strong application.",
  },
  {
    question: "CAN CNC HELP ME FIND A SHORT-TERM RENTAL?",
    answer:
      "Yes — we can assist with month-to-month and short-term leases in addition to standard 12-month agreements. Availability varies by area, so connect with one of our agents and we'll find options that fit your timeline.",
  },
];

export default function RentPage() {
  return (
    <main className="min-h-screen bg-[#F2F0EF]">
      <RentHero />
      <div data-navbar-theme="light">
        <RentSteps />
      </div>
      <RentCitiesSlider />
      <FAQ faqs={RENT_FAQS} className="bg-[#DAD4D2]" />
      <GradientBridge from="#DAD4D2" to="#F2F0EF" />
      <div data-navbar-theme="light">
        <PageCTA
          heading={<>Take the First <span className="text-cnc-gold font-medium">Step</span></>}
          body="We'll help you get there"
          primaryHref="/properties?listingType=FOR_RENT"
          primaryLabel="Search Rentals"
          secondaryLabel="Message"
          showContactModal
          contactSource="RENT_CTA"
        />
      </div>
    </main>
  );
}
