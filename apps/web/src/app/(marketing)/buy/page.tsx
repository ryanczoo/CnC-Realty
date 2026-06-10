import { Metadata } from "next";
import { PageCTA } from "@/components/ui/PageCTA";
import { BuyHero } from "@/components/buy/BuyHero";
import { BuyFeatures } from "@/components/buy/BuyFeatures";
import { BuySteps } from "@/components/buy/BuySteps";
import { BuyContemporary } from "@/components/buy/BuyContemporary";

export const metadata: Metadata = {
  title: "Buy a Home | CnC Realty",
  description: "Search thousands of California homes with CnC Realty. Expert buyer's agents, live MLS listings, and zero pressure.",
};

export default function BuyPage() {
  return (
    <main data-navbar-theme="light" className="min-h-screen bg-[#F2F0EF]">
      <BuyHero />
      <BuyFeatures />

      {/* Steps — replaces "How it Works" grid */}
      <BuySteps />

      <BuyContemporary />

      <PageCTA
        heading={<>Let's Get <span className="text-cnc-gold font-medium">Started</span></>}
        body="We're one click away"
        primaryHref="/properties"
        primaryLabel="Search Homes"
        secondaryHref="/contact"
        secondaryLabel="Message"
      />
    </main>
  );
}
