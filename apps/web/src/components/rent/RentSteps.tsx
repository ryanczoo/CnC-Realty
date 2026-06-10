"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import { fadeUp, PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

const STEPS = [
  {
    num: "01",
    title: "Budgeting",
    body: "Perform a financial self-assessment to determine your ideal monthly rental cost. Factor in utilities, moving costs, and security deposit (in CA this is capped at one or two months).",
  },
  {
    num: "02",
    title: "Applying",
    body: "A CnC agent will assist you in searching for the perfect property and complete a rental application. This usually includes proof of income, ID, and a reference.",
  },
  {
    num: "03",
    title: "Screening",
    body: "Most landlords will require a fee to conduct a credit/background check. Reaching this stage means your application has a strong chance of being accepted!",
  },
  {
    num: "04",
    title: "Signing",
    body: "Once approved, you will receive a lease agreement that your CnC agent will review with you to ensure all terms are correct. This is super important to adhere and agree to.",
  },
  {
    num: "05",
    title: "Moving",
    body: "Congratulations! You are now ready to make the move. Before getting the keys, make sure to inspect the property for pre-existing damages or issues.",
  },
];

export function RentSteps() {
  return (
    <section className="bg-cnc-bg px-[75px] py-28">
      <div className="flex gap-10">

        {/* Left: heading + CTA */}
        <div className="flex flex-1 flex-col gap-8 sticky top-28 self-start">
          <h2 className="font-sans font-light leading-[1.1]">
            <RevealLine className="block text-[1.9rem] xl:text-[2.2rem]">Moving made,</RevealLine>
            <span className="block pl-[7.5rem]">
              <RevealLine className="text-[3rem] xl:text-[3.5rem] font-medium" color="#9E8C61" delay={0.15}>Easy</RevealLine>
            </span>
          </h2>
          <motion.div
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            className="ml-[7.5rem] w-fit"
          >
            <Link
              href="/properties?listingType=FOR_RENT"
              className="inline-flex items-center gap-2 rounded-full bg-cnc-dark px-6 py-3 font-sans text-sm text-white"
            >
              Search <span aria-hidden>→</span>
            </Link>
          </motion.div>
        </div>

        {/* Right: steps list */}
        <div className="shrink-0 basis-[57%]">
<div>
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                {...fadeUp(i * 0.12)}
                className="flex items-center gap-10 border-t border-[#1B1B1B]/[0.07] py-6"
              >
                <span className="w-8 shrink-0 font-sans text-base font-medium tracking-widest text-cnc-gold">
                  {step.num}
                </span>
                <div className="font-sans font-medium leading-[1.15]">
                  <p className="text-[2.1rem] text-[#1B1B1B]">{step.title}</p>
                  <p className="mt-2 text-base font-light leading-relaxed text-[#1B1B1B]/50">{step.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
