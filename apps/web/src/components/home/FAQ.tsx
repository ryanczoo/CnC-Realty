"use client";

import { motion } from "motion/react";
import { RevealText } from "@/components/ui/reveal-text";

const FAQS = [
  {
    question: "WHAT IS THE FIRST STEP TO BUYING A HOME?",
    answer:
      "Anyone's first step when buying a home is getting pre-approved. CnC works with a variety of loan officers to help with you that and also find the best type of loan you qualify for. Connect with an agent today to get started.",
  },
  {
    question: "HOW DO I SELL MY HOME FOR MAXIMUM VALUE?",
    answer:
      "The little details matter. Staging, listing photos, open house timing all play a huge role in displaying your home or property correctly on the market. Reach out today for a free consultation.",
  },
  {
    question: "CAN I JOIN CNC AS A NEW AGENT?",
    answer:
      "Absolutely, CnC welcomes agents at all stages of their career. New agents benefit the most with our mentorship program, and more experienced agents love the freedom to control their schedule. Not to mention the 100% commission!",
  },
  {
    question: "HOW DOES PROPERTY MANAGEMENT WORK?",
    answer:
      "CnC offers complete concierge services for any type of property within Los Angeles, Orange, and most of Riverside or San Bernadino counties. Send us a message to find out if your property qualifies!",
  },
];

export function FAQ() {
  return (
    <section data-navbar-theme="light" className="bg-[#F2F0EF] px-8 pb-20 pt-16 lg:px-20">
      <motion.h2
        className="mb-6 font-sans text-[2.8rem] font-light leading-[1.0] xl:text-[3.5rem]"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        viewport={{ once: true }}
      >
        <RevealText>FAQ<span style={{ color: "#9E8C61" }}>s</span></RevealText>
      </motion.h2>

      <div>
        {FAQS.map((faq, i) => (
          <motion.div
            key={i}
            className="relative grid cursor-default py-6"
            style={{ gridTemplateColumns: "26% 52% 22%" }}
            initial="rest"
            whileHover="hover"
          >
            {/* Border — only visible on hover */}
            <motion.div
              className="absolute left-0 right-0 top-0 h-px bg-[#1B1B1B]"
              variants={{ rest: { opacity: 0 }, hover: { opacity: 0.12 } }}
              transition={{ duration: 0.2 }}
            />

            <p className="font-sans text-[1.15rem] font-light leading-tight text-[#1B1B1B] xl:text-[1.3rem]">
              {faq.question}
            </p>

            {/* Answer — revealed on hover */}
            <motion.p
              className="pl-24 pr-8 font-sans text-base leading-relaxed text-[#1B1B1B]/50"
              variants={{
                rest: { opacity: 0, y: 6 },
                hover: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {faq.answer}
            </motion.p>

            <span className="pt-1 text-right font-sans text-sm text-[#1B1B1B]/25">( {i + 1} )</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
