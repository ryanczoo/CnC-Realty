"use client";

import { motion } from "motion/react";

const STEPS = [
  {
    number: "01",
    title: "Apply Online",
    body: "Submit an application to begin your journey with CnC.",
  },
  {
    number: "02",
    title: "Schedule a Call",
    body: "Speak with a team member to discuss your goals and how we can support them.",
  },
  {
    number: "03",
    title: "Sign Your Contract",
    body: "Complete our onboarding process to ensure you're equipped for success.",
  },
  {
    number: "04",
    title: "Start Earning",
    body: "Hit the ground running with full access to our CRM, tools, and mentorship network from day one.",
  },
];

export function HowToJoin() {
  return (
    <section className="bg-cnc-bg px-8 py-28 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex gap-24">

          {/* Left — sticky heading + button */}
          <div className="w-[45%] shrink-0">
            <div className="sticky top-28">
              <h2 className="font-sans leading-[1.1]">
                <span className="block text-[2.5rem] font-light text-[#1B1B1B]">How to</span>
                <span className="block text-[3.5rem] font-light text-[#1B1B1B]">Join <span className="text-[#9E8C61]">CnC</span></span>
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80"
                alt="Join CnC"
                className="h-[380px] w-full object-cover"
              />
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
