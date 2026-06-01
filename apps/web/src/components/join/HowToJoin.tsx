"use client";

import { motion } from "motion/react";
import { RevealText, RevealLine } from "@/components/ui/reveal-text";

const STEPS = [
  {
    number: "01",
    title: "Apply",
    body: "Fill out an application and review the Independent Contractor Agreement.",
  },
  {
    number: "02",
    title: "Approval",
    body: "Get your guaranteed approval to join the team within 24 hours.",
  },
  {
    number: "03",
    title: "Onboarding",
    body: "A team member will welcome and prep you for your new journey.",
  },
  {
    number: "04",
    title: "Win",
    body: "Hit the ground running with full access to all our tools and network.",
  },
];

export function HowToJoin() {
  return (
    <section data-navbar-theme="light" className="relative z-10 bg-cnc-bg px-8 pt-6 pb-28 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex gap-24">

          {/* Left — sticky heading + button */}
          <div className="w-[45%] shrink-0">
            <div className="sticky top-28">
              <h2 className="font-sans leading-[1.1]">
                <span className="block text-[2.5rem] font-light"><RevealText>How to</RevealText></span>
                <span className="block text-[3.5rem] font-light"><RevealLine delay={0.15}>Join <span className="text-[#9E8C61]">CnC</span></RevealLine></span>
              </h2>
              <motion.a
                href="/join/agent"
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#1B1B1B] px-6 py-3 font-sans text-sm text-white"
              >
                Apply Now →
              </motion.a>
            </div>
          </div>

          {/* Right — steps + photo */}
          <div className="flex flex-1 gap-12">

            {/* Steps list */}
            <div className="flex-1">
              {STEPS.map((step) => (
                <div key={step.number} className="py-10">
                  <p className="mb-4 font-sans text-sm text-[#1B1B1B]/30">{step.number}</p>
                  <h3 className="mb-3 font-sans text-[2.2rem] font-light text-[#1B1B1B]">{step.title}</h3>
                  <p className="max-w-sm font-sans text-base text-[#1B1B1B]/50">{step.body}</p>
                </div>
              ))}
            </div>

            {/* Photo — sits beside the first two steps */}
            <div className="w-72 shrink-0 pt-10">
              <div className="h-[380px] w-full overflow-hidden rounded-2xl shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/join-house.jpg"
                  alt="Join CnC"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
