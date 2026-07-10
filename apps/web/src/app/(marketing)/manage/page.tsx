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
        heading={<>Dare To Do <span className="text-cnc-gold font-medium">More</span></>}
        body="Chat with our management team"
        secondaryLabel="Message"
        secondaryClassName="inline-flex items-center rounded-full bg-[#9E8C61] px-8 py-3.5 font-sans text-sm font-medium text-white"
        showContactModal
        contactSource="MANAGE_CTA"
      />
    </main>
  );
}
