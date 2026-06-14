import { Metadata } from "next";
import { PageCTA } from "@/components/ui/PageCTA";
import { ManageHero } from "@/components/manage/ManageHero";
import { ManageQuote } from "@/components/manage/ManageQuote";
import { ManageHandle } from "@/components/manage/ManageHandle";

export const metadata: Metadata = {
  title: "Property Management | CnC Realty",
  description: "Full-service property management across Southern California. Tenant placement, rent collection, maintenance coordination, and more.",
};

export default function ManagePage() {
  return (
    <main className="min-h-screen bg-[#F2F0EF]">
      <ManageHero />

      <ManageQuote />

      <ManageHandle />

      <PageCTA
        heading={<>Ready to go <span className="text-cnc-gold">hands-off?</span></>}
        body="Talk to our property management team — no obligation."
        primaryHref="/contact"
        primaryLabel="Schedule a Consultation →"
        secondaryLabel="Message"
        showContactModal
        contactSource="MANAGE_CTA"
      />
    </main>
  );
}
