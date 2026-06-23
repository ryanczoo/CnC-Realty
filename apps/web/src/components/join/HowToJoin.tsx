"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { RevealText, RevealLine } from "@/components/ui/reveal-text";
import { SPRING_HOVER, PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";

const MotionLink = motion(Link);

const STEPS = [
  {
    number: "01",
    title: "Apply",
    body: "Fill out an application and review the Independent Contractor Agreement.",
  },
  {
    number: "02",
    title: "Approve",
    body: "Get your guaranteed approval to join the team within 24 hours.",
  },
  {
    number: "03",
    title: "Onboard",
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
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40" style={{ background: "linear-gradient(to bottom, transparent, white)" }} />
      <div className="mx-auto max-w-7xl">
        <div className="flex gap-24">

          {/* Left — sticky heading + button */}
          <div className="w-[45%] shrink-0">
            <div className="sticky top-28">
              <h2 className="font-sans leading-[1.1] -ml-16">
                <span className="block text-[2.5rem] font-light"><RevealText>How to</RevealText></span>
                <span className="block pl-[5.5rem] text-[3.5rem] font-medium"><RevealLine delay={0.15}>Join <span className="text-[#9E8C61]">CnC</span></RevealLine></span>
              </h2>
              <MotionLink
                href="/join/agent"
                animate={PULSE_ANIMATE}
                whileHover={{ scale: 1.1, transition: SPRING_HOVER }}
                transition={PULSE_TRANSITION}
                className="mt-8 ml-[1.5rem] inline-flex items-center rounded-full bg-[#1B1B1B] px-6 py-3 font-sans text-sm text-white"
              >
                Apply Now
              </MotionLink>
            </div>
          </div>

          {/* Right — steps + photo */}
          <div className="flex flex-1 gap-12">

            {/* Steps list */}
            <div className="flex-1">
              {STEPS.map((step) => (
                <div key={step.number} className="py-10">
                  <p className="mb-4 font-sans text-base font-medium tracking-widest text-cnc-gold">{step.number}</p>
                  <h3 className="mb-3 font-sans text-[2.2rem] font-medium text-[#1B1B1B]">{step.title}</h3>
                  <p className="max-w-sm font-sans text-base text-[#1B1B1B]/50">{step.body}</p>
                </div>
              ))}
            </div>

            {/* Photo — sticky, mirrors the heading column */}
            <div className="w-72 shrink-0 pt-10 sticky top-28 self-start">
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
