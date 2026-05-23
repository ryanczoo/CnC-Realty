import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join CnC Realty | Agent Opportunities",
  description: "100% commission, AI-driven CRM, and real mentorship. Join CnC Realty and build the real estate career you've always wanted.",
};

const BENEFITS = [
  {
    number: "01",
    title: "100% Commission",
    body: "Keep every dollar you earn — no desk fees, no commission splits, no surprises. Plain and simple.",
  },
  {
    number: "02",
    title: "AI-Driven CRM",
    body: "Our custom platform handles lead tracking, follow-ups, transaction management, and campaign automation — built specifically for CnC agents.",
  },
  {
    number: "03",
    title: "Training & Mentorship",
    body: "New agents are paired with a senior mentor. Every agent gets unlimited access to our video library and market guides.",
  },
  {
    number: "04",
    title: "CRMLS Access",
    body: "Full MLS access through CRMLS — California's largest MLS with over 100,000 active listings across the state.",
  },
  {
    number: "05",
    title: "Build Your Brand",
    body: "Your public agent profile, your listings, your team. CnC provides the infrastructure — you build the business.",
  },
  {
    number: "06",
    title: "Instant Approval",
    body: "Guaranteed approval for all licensed California real estate agents. Transfer your license in days, not weeks.",
  },
];

const FAQS = [
  {
    q: "Do I need experience to join CnC?",
    a: "No. We welcome brand-new agents and welcome them into our mentorship program. Experienced agents can also transfer with a fast, straightforward process.",
  },
  {
    q: "What are the fees?",
    a: "There are no desk fees and no commission splits. You keep 100% of your commissions. The only cost is your California DRE license fee (paid to the state, not CnC).",
  },
  {
    q: "How do I get started?",
    a: 'Click "Start Your Application" below, fill out the agent onboarding form, and a member of our team will reach out within 24 hours to complete your transfer.',
  },
  {
    q: "Can I join if I'm already with another brokerage?",
    a: "Yes. License transfers in California are straightforward. We'll walk you through the process step by step.",
  },
];

export default function JoinPage() {
  return (
    <main className="min-h-screen bg-[#F2F0EF]">
      {/* Hero */}
      <section className="px-8 pb-24 pt-40 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 font-sans text-sm font-medium uppercase tracking-widest text-[#9E8C61]">Join CnC</p>
          <h1 className="mb-6 font-sans text-[3.5rem] font-light leading-tight text-[#1B1B1B] lg:text-[5.5rem]">
            Be the agent<br />you&apos;re meant to be.
          </h1>
          <p className="mb-10 max-w-xl font-sans text-lg font-light text-[#1B1B1B]/60">
            100% commission. No desk fees. AI-powered tools. Real mentorship. Join CnC Realty and keep everything you earn.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/join/agent"
              className="inline-flex items-center gap-2 rounded-full bg-[#9E8C61] px-8 py-3.5 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80"
            >
              Start Your Application →
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-[#1B1B1B]/20 px-8 py-3.5 font-sans text-sm font-medium text-[#1B1B1B] transition-colors hover:border-[#1B1B1B]/50"
            >
              Talk to Us First
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t border-[#1B1B1B]/8 px-8 py-24 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 font-sans text-[2rem] font-light text-[#1B1B1B]">What you get at CnC</h2>
          <div className="grid grid-cols-1 gap-px bg-[#1B1B1B]/8 md:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((item) => (
              <div key={item.number} className="bg-[#F2F0EF] p-8">
                <p className="mb-3 font-sans text-xs font-medium text-[#9E8C61]">{item.number}</p>
                <h3 className="mb-2 font-sans text-base font-semibold text-[#1B1B1B]">{item.title}</h3>
                <p className="font-sans text-sm font-light leading-relaxed text-[#1B1B1B]/60">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[#1B1B1B]/8 px-8 py-24 lg:px-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 font-sans text-[2rem] font-light text-[#1B1B1B]">Common questions</h2>
          <div className="space-y-0 divide-y divide-[#1B1B1B]/8">
            {FAQS.map((faq) => (
              <div key={faq.q} className="py-8">
                <h3 className="mb-3 font-sans text-base font-medium text-[#1B1B1B]">{faq.q}</h3>
                <p className="font-sans text-sm font-light leading-relaxed text-[#1B1B1B]/60">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-8 pb-24 lg:px-20">
        <div className="mx-auto max-w-5xl rounded-2xl bg-[#1B1B1B] px-10 py-14 text-center">
          <h2 className="mb-2 font-sans text-[2rem] font-light text-white">Instant guaranteed approval</h2>
          <p className="mb-2 font-sans text-base text-white/50">for all licensed California agents.</p>
          <p className="mb-10 font-sans text-sm text-[#9E8C61]">Together, we are CnC.</p>
          <Link
            href="/join/agent"
            className="inline-flex rounded-full bg-[#9E8C61] px-8 py-3.5 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            Start Your Application →
          </Link>
        </div>
      </section>
    </main>
  );
}
