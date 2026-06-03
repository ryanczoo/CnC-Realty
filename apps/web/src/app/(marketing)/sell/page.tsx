import { Metadata } from "next";
import { SellProcess } from "@/components/sell/SellProcess";
import { PageCTA } from "@/components/ui/PageCTA";
import { SellHero } from "@/components/sell/SellHero";

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
        <PageCTA
          heading={<>What&apos;s your home <span style={{ color: "#9E8C61" }}>worth?</span></>}
          body="Get a free, no-obligation valuation from a CnC agent."
          primaryHref="/contact"
          primaryLabel="Request a Valuation →"
          secondaryHref="/agents"
          secondaryLabel="Meet Our Agents"
        />
      </div>
    </main>
  );
}
