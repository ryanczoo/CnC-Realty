import { Metadata } from "next";
import { PageCTA } from "@/components/ui/PageCTA";
import { ManageServices } from "@/components/manage/ManageServices";
import { ManageHero } from "@/components/manage/ManageHero";
import { ManageHandle } from "@/components/manage/ManageHandle";

export const metadata: Metadata = {
  title: "Property Management | CnC Realty",
  description: "Full-service property management across Southern California. Tenant placement, rent collection, maintenance coordination, and more.",
};

export default function ManagePage() {
  return (
    <main className="min-h-screen bg-[#F2F0EF]">
      <ManageHero />

      <ManageServices />

      <ManageHandle />

      <PageCTA
        heading={<>Ready to go <span className="text-cnc-gold">hands-off?</span></>}
        body="Talk to our property management team — no obligation."
        primaryHref="/contact"
        primaryLabel="Schedule a Consultation →"
        secondaryHref="/properties"
        secondaryLabel="View Listings"
      />
    </main>
  );
}
