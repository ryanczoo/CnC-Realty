import Link from "next/link";
import { Metadata } from "next";
import { JoinFaq } from "@/components/join/JoinFaq";

export const metadata: Metadata = {
  title: "Join CnC Realty | Agent Opportunities",
  description: "100% commission, AI-driven CRM, and real mentorship. Join CnC Realty and build the real estate career you've always wanted.",
};

const STATS = [
  { value: "100%", label: "Commission Kept" },
  { value: "$0", label: "Desk Fees" },
  { value: "100K+", label: "MLS Listings" },
  { value: "24 hrs", label: "Transfer Approval" },
];

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
    a: "No. We welcome brand-new agents into our mentorship program. Experienced agents can also transfer with a fast, straightforward process.",
  },
  {
    q: "What are the fees?",
    a: "There are no desk fees and no commission splits. You keep 100% of your commissions. The only cost is your California DRE license fee, paid directly to the state.",
  },
  {
    q: "How do I get started?",
    a: "Click \"Start Your Application\", fill out the agent onboarding form, and a member of our team will reach out within 24 hours to complete your transfer.",
  },
  {
    q: "Can I join if I'm already with another brokerage?",
    a: "Yes. License transfers in California are straightforward. We'll walk you through every step of the process.",
  },
  {
    q: "What technology do CnC agents get?",
    a: "Every agent gets access to our AI-driven CRM with lead tracking, automated follow-ups, transaction management, and marketing campaign tools — all built in-house for CnC.",
  },
];

export default function JoinPage() {
  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative flex h-screen items-center justify-center overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover object-center"
          src="/videos/join-hero.mp4"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/75" />

        <div className="relative z-10 px-8 text-center">
          <p className="mb-5 font-sans text-xs font-medium uppercase tracking-[0.4em] text-[#9E8C61]">
            CnC Realty Group
          </p>
          <h1 className="font-sans text-[5.5rem] font-black leading-none tracking-tight text-white lg:text-[10rem]">
            BE CnC.
          </h1>
          <p className="mx-auto mt-7 mb-10 max-w-lg font-sans text-lg font-light text-white/65">
            100% commission. No desk fees. AI-powered tools. Built for California agents who mean business.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/join/agent"
              className="inline-flex items-center gap-2 rounded-full bg-[#9E8C61] px-8 py-3.5 font-sans text-sm font-medium text-white transition-opacity hover:opacity-85"
            >
              Start Your Application →
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-8 py-3.5 font-sans text-sm font-medium text-white transition-colors hover:border-white/70"
            >
              Talk to Us First
            </Link>
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
          <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-white/30">Scroll</span>
          <div className="h-10 w-px bg-gradient-to-b from-white/30 to-transparent" />
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="bg-[#9E8C61]">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-around gap-8 px-8 py-10">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-sans text-3xl font-bold text-white">{stat.value}</p>
              <p className="mt-1 font-sans text-xs font-light uppercase tracking-widest text-white/70">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="bg-[#111111] px-8 py-28 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 font-sans text-xs font-medium uppercase tracking-widest text-[#9E8C61]">Why CnC</p>
          <h2 className="mb-16 font-sans text-[2.5rem] font-light leading-tight text-white">
            Everything you need to thrive.
          </h2>
          <div className="grid grid-cols-1 gap-px bg-white/5 md:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((item) => (
              <div
                key={item.number}
                className="group bg-[#111111] p-8 transition-colors duration-200 hover:bg-white/5"
              >
                <p className="mb-3 font-sans text-xs font-medium text-[#9E8C61]">{item.number}</p>
                <h3 className="mb-2 font-sans text-base font-semibold text-white transition-colors duration-200 group-hover:text-[#9E8C61]">
                  {item.title}
                </h3>
                <p className="font-sans text-sm font-light leading-relaxed text-white/40">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-[#0f0f0f] px-8 py-28 lg:px-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 font-sans text-xs font-medium uppercase tracking-widest text-[#9E8C61]">Got questions?</p>
          <h2 className="mb-12 font-sans text-[2rem] font-light text-white">Common questions</h2>
          <JoinFaq faqs={FAQS} />
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-[#9E8C61] px-8 py-28 lg:px-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 font-sans text-[2.5rem] font-light leading-tight text-white">
            Ready to make the move?
          </h2>
          <p className="mb-2 font-sans text-base text-white/70">
            Instant guaranteed approval for all licensed California agents.
          </p>
          <p className="mb-10 font-sans text-sm text-white/50">Together, we are CnC.</p>
          <Link
            href="/join/agent"
            className="inline-flex rounded-full bg-white px-8 py-3.5 font-sans text-sm font-medium text-[#9E8C61] transition-opacity hover:opacity-90"
          >
            Start Your Application →
          </Link>
        </div>
      </section>
    </main>
  );
}
