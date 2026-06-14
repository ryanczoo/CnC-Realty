import { Metadata } from "next";
import { PageCTA } from "@/components/ui/PageCTA";
import { BuyHero } from "@/components/buy/BuyHero";
import { BuyFeatures } from "@/components/buy/BuyFeatures";
import { BuySteps } from "@/components/buy/BuySteps";
import { BuyContemporary } from "@/components/buy/BuyContemporary";
import { FAQ } from "@/components/home/FAQ";
import { GradientBridge } from "@/components/ui/GradientBridge";

const BUY_FAQS = [
  {
    question: "DO I NEED TO GET PRE-APPROVED BEFORE SEARCHING?",
    answer:
      "Getting pre-approved first is strongly recommended. It tells you exactly how much you can afford, makes your offer more competitive, and shows sellers you're serious. CnC works with trusted local lenders who can get you pre-approved quickly — ask your agent to connect you.",
  },
  {
    question: "HOW MUCH DO I NEED FOR A DOWN PAYMENT?",
    answer:
      "It depends on the loan type. Conventional loans typically require 5–20%, FHA loans as little as 3.5%, and VA or USDA loans can be 0% down for qualifying buyers. Your lender will walk you through the options that fit your financial situation.",
  },
  {
    question: "HOW LONG DOES THE HOMEBUYING PROCESS TAKE?",
    answer:
      "From offer acceptance to close of escrow, most California transactions take 30–45 days. The time it takes to find the right home varies — some buyers find it in a week, others take a few months. Your CnC agent will help you move as fast or as comfortably as you need.",
  },
  {
    question: "DOES IT COST ME ANYTHING TO USE A CNC BUYER'S AGENT?",
    answer:
      "In most cases, no. The seller typically covers the buyer's agent commission through escrow. Your CnC agent advocates entirely for your interests — at no out-of-pocket cost to you. Your agent will be transparent about any exceptions before you sign anything.",
  },
];

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

      <GradientBridge from="#F2F0EF" to="#DAD4D2" />
      <FAQ faqs={BUY_FAQS} className="bg-[#DAD4D2]" />
      <GradientBridge from="#DAD4D2" to="#F2F0EF" />

      <PageCTA
        heading={<>Let's Get <span className="text-cnc-gold font-medium">Started</span></>}
        body="We're one click away"
        primaryHref="/properties"
        primaryLabel="Search Homes"
        secondaryLabel="Message"
        showContactModal
        contactSource="BUY_CTA"
      />
    </main>
  );
}
