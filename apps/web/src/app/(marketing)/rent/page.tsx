import { Metadata } from "next";
import { RentHero } from "@/components/rent/RentHero";
import { RentSteps } from "@/components/rent/RentSteps";
import { RentCitiesSlider } from "@/components/rent/RentCitiesSlider";
import { PageCTA } from "@/components/ui/PageCTA";

export const metadata: Metadata = {
  title: "Rent | CnC Realty",
  description: "Find your next rental in California with CnC Realty. Live CRMLS lease listings with expert tenant representation.",
};

export default function RentPage() {
  return (
    <main className="min-h-screen bg-[#F2F0EF]">
      <RentHero />
      <RentSteps />
      <RentCitiesSlider />
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
