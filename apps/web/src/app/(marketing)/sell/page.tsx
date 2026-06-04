import { Metadata } from "next";
import { SellProcess } from "@/components/sell/SellProcess";
import { PageCTA } from "@/components/ui/PageCTA";
import { SellHero } from "@/components/sell/SellHero";
import { FAQ } from "@/components/home/FAQ";

export const metadata: Metadata = {
  title: "Sell Your Home | CnC Realty",
  description: "List with CnC Realty and get full CRMLS exposure, expert pricing, and a dedicated agent to manage your sale from start to close.",
};

export default function SellPage() {
  return (
    <main>
      <SellHero />

      {/* ── Light sections ── */}
      <div data-navbar-theme="light" className="bg-[#F2F0EF]">
        <SellProcess />
        <FAQ className="bg-[#DAD4D2]" faqs={[
          {
            question: "HOW LONG WILL IT TAKE TO SELL MY PROPERTY?",
            answer: "The best way to find out is by contacting an experienced real estate agent for your area. They can tell you the average sale times for similar properties as well as the prices they sold for.",
          },
          {
            question: "SHOULD I GET A HOME INSPECTION?",
            answer: "Although not required by law, a pre-sale home inspection is highly recommended to know exactly what the buyer might find later. Typically, buyer still request a general home inspection along with termite and pest.",
          },
          {
            question: "WHAT ARE CLOSING COSTS?",
            answer: "As a seller, you typically pay for the title insurance policy, escrow fees, agent commissions, and county transfer taxes. However, agent commissions is negotiable and possible tax exclusions may apply for primary residences.",
          },
          {
            question: "DO I NEED TO RENOVATE MY HOME OR SELL \"AS-IS\"?",
            answer: "You are not legally required to remodel your home before a sale. However, improving your home with strategic cosmetic touch-ups usually yield a higher return on investment. Any known defects must be disclosed to the buyer.",
          },
        ]} />
        <div style={{ height: "80px", background: "linear-gradient(to bottom, #DAD4D2, #F2F0EF)" }} />
        <PageCTA
          heading={<>Free Property-Value <span style={{ color: "#9E8C61" }}>Estimate</span></>}
          body="By an experienced CnC Agent"
          primaryHref="/contact"
          primaryLabel="Request Valuation"
        />
      </div>
    </main>
  );
}
