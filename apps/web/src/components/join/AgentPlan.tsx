"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

const BENEFITS: { label: string; muted?: string }[] = [
  { label: "100% Commission" },
  { label: "$990 Flat Broker Fee" },
  { label: "E&O Insurance included through $1M", muted: "– $400 per $500k over $1M" },
  { label: "Customer Relation Management System Access" },
  { label: "Transaction Management Software Access" },
  { label: "Personal Agent Profile Page" },
  { label: "24/7 Broker Support" },
  { label: "AI-Powered Tools" },
  { label: "No Desk Fees" },
  { label: "No Quotas" },
  { label: "No Long Term Commitment" },
  { label: "Optional Transaction Coordinator Service", muted: "– $350 through escrow" },
];

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      className="mt-[1px] flex-shrink-0"
    >
      <path d="M20.94,11A8.26,8.26,0,0,1,21,12a9,9,0,1,1-9-9,8.83,8.83,0,0,1,4,1" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="21 5 12 14 8 10" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AgentPlan() {
  return (
    <section className="relative z-10 bg-cnc-bg px-8 py-24 lg:px-20">
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-white" />
      <div className="mx-auto flex max-w-7xl gap-20">

        {/* LEFT — section title */}
        <div className="flex-1 pt-6">
          <div className="sticky top-28">
            <h2 className="font-sans font-light leading-[1.0]">
              <span className="block -ml-[4rem] text-[2.5rem] xl:-ml-[4.8rem] xl:text-[3rem]">
                <RevealLine>For Agents,</RevealLine>
              </span>
              <span className="block text-[3.5rem] font-medium xl:text-[4.2rem]">
                <RevealLine delay={0.15}>
                  By <span className="text-[#9E8C61]">Agents</span>
                </RevealLine>
              </span>
            </h2>
            <div className="mt-8 w-[80%] overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/join-city.jpg"
                alt="Los Angeles skyline at sunset"
                className="h-[260px] w-full object-cover object-[center_55%]"
              />
            </div>
          </div>
        </div>

        {/* RIGHT — plan card */}
        <div className="mr-24 w-[420px] flex-shrink-0 rounded-2xl bg-white p-10 shadow-[0_4px_32px_rgba(0,0,0,0.07)]">
          {/* Plan name */}
          <h3 className="font-sans text-[3.2rem] font-bold leading-none text-[#1B1B1B]">
            Professional
          </h3>

          <hr className="my-6 border-[#1B1B1B]/10" />

          {/* Price */}
          <p className="font-sans text-[1.4rem] font-medium text-[#1B1B1B]">
            $0<span className="text-base font-normal text-[#1B1B1B]/45">/month</span>
          </p>

          {/* Best for */}
          <p className="mt-2 font-sans text-sm leading-relaxed text-[#1B1B1B]/50">
            Forever
          </p>

          {/* CTA */}
          <motion.div
            className="mt-8"
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          >
            <Link
              href="/join/apply"
              className="flex w-full items-center justify-center rounded-full bg-[#1B1B1B] px-8 py-4 font-sans text-base font-medium text-white"
            >
              Get Started
            </Link>
          </motion.div>

          <hr className="my-8 border-[#1B1B1B]/10" />

          {/* Benefits */}
          <ul className="space-y-4">
            {BENEFITS.map((b) => (
              <li key={b.label} className="flex items-start gap-3">
                <CheckIcon />
                <span className="font-sans text-sm leading-snug text-[#1B1B1B]">
                  {b.label}
                  {b.muted && (
                    <span className="block text-[#1B1B1B]/45">{b.muted}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-6 font-sans text-xs text-[#1B1B1B]">
            Additional terms apply, please refer to the{" "}
            <a href="/join/ica" className="underline underline-offset-2">ICA</a>
            {" "}for more details.
          </p>
        </div>

      </div>
    </section>
  );
}
