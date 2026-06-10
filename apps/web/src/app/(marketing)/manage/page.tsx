import Link from "next/link";
import { Metadata } from "next";
import { RevealText } from "@/components/ui/reveal-text";
import { PageCTA } from "@/components/ui/PageCTA";
import { ManageServices } from "@/components/manage/ManageServices";

export const metadata: Metadata = {
  title: "Property Management | CnC Realty",
  description: "Full-service property management across Southern California. Tenant placement, rent collection, maintenance coordination, and more.",
};

const SERVICES = [
  {
    title: "Tenant Placement",
    body: "We market your property on CRMLS and major platforms, screen applicants thoroughly, and place qualified tenants fast.",
  },
  {
    title: "Rent Collection",
    body: "Automated rent collection with direct deposit to your account. Late payments handled professionally so you don't have to.",
  },
  {
    title: "Maintenance Coordination",
    body: "24/7 maintenance request line. We coordinate with licensed vendors, get multiple bids, and keep you informed at every step.",
  },
  {
    title: "Financial Reporting",
    body: "Monthly income and expense statements, annual reports for tax prep, and a live owner portal to see everything in real time.",
  },
  {
    title: "Lease Management",
    body: "California-compliant leases, renewals, rent increase notices, and move-out inspections — all handled by our team.",
  },
  {
    title: "Eviction Protection",
    body: "When necessary, we follow California eviction law precisely and work with our legal partners to protect your investment.",
  },
];

export default function ManagePage() {
  return (
    <main data-navbar-theme="light" className="min-h-screen bg-[#F2F0EF]">
      <section className="px-8 pb-24 pt-40 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 font-sans text-sm font-medium uppercase tracking-widest text-[#9E8C61]">Property Management</p>
          <h1 className="mb-6 font-sans text-[3.5rem] font-light leading-tight lg:text-[5rem]">
            <span className="block"><RevealText>Your investment,</RevealText></span>
            <span className="block"><RevealText delay={0.15}>expertly managed.</RevealText></span>
          </h1>
          <p className="mb-10 max-w-xl font-sans text-lg font-light text-[#1B1B1B]/60">
            Full-service property management across Southern California. We handle everything so you can be a hands-off owner.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full bg-[#1B1B1B] px-8 py-3.5 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            Get a Free Consultation →
          </Link>
        </div>
      </section>

      <ManageServices />

      <section className="border-t border-[#1B1B1B]/20 px-8 py-24 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 font-sans text-[2rem] font-light"><RevealText>What we handle</RevealText></h2>
          <div className="grid grid-cols-1 gap-px bg-[#1B1B1B]/20 md:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((item) => (
              <div key={item.title} className="bg-[#F2F0EF] p-8">
                <h3 className="mb-3 font-sans text-base font-semibold text-[#1B1B1B]">{item.title}</h3>
                <p className="font-sans text-sm font-light leading-relaxed text-[#1B1B1B]/60">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
