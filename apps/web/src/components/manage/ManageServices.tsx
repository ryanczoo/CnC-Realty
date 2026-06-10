"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER, fadeUp } from "@/lib/motion";

const MotionLink = motion(Link);

const CARDS = [
  {
    title: "Tenant Placement",
    body: "We market your property across CRMLS and top rental platforms, screen applicants thoroughly, and place qualified tenants fast.",
    image: "https://picsum.photos/seed/manage-tenant/800/600",
    href: "/contact",
  },
  {
    title: "Full-Service Operations",
    body: "Maintenance coordination, rent collection, lease renewals — every detail handled so you can be a true hands-off owner.",
    image: "https://picsum.photos/seed/manage-ops/800/600",
    href: "/contact",
  },
  {
    title: "Owner Reporting & Legal",
    body: "Monthly income statements, annual tax reports, and a live owner portal — plus full California lease compliance.",
    image: "https://picsum.photos/seed/manage-finance/800/600",
    href: "/contact",
  },
];

export function ManageServices() {
  return (
    <section data-navbar-theme="dark" className="bg-[#1B1B1B] text-white py-24 md:py-[150px] overflow-hidden">
      <style>{`
        .manage-cards-grid {
          transition: grid-template-columns 1s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (min-width: 768px) and (pointer: fine) {
          .manage-cards-grid:has(.manage-card:nth-child(1):hover) { grid-template-columns: 1.2fr 0.9fr 0.9fr; }
          .manage-cards-grid:has(.manage-card:nth-child(2):hover) { grid-template-columns: 0.9fr 1.2fr 0.9fr; }
          .manage-cards-grid:has(.manage-card:nth-child(3):hover) { grid-template-columns: 0.9fr 0.9fr 1.2fr; }
          .manage-card .card-body-text { opacity: 0; transition: opacity 0.4s ease; }
          .manage-card:hover .card-body-text { opacity: 1; }
        }
      `}</style>

      <div className="mx-auto max-w-[1920px] px-10 md:px-[100px]">
        {/* Header row — heading left, text + CTA right */}
        <div className="grid gap-12 md:grid-cols-2 md:gap-20 items-center">
          <motion.h2
            {...fadeUp(0)}
            className="font-sans font-medium text-[42px] leading-[105%] tracking-[-0.02em] md:text-[68px] md:leading-[100%] md:tracking-[-0.04em]"
          >
            Property Management,{" "}
            <span className="text-white/40">Fully Handled.</span>
          </motion.h2>

          <motion.div {...fadeUp(0.1)} className="flex flex-col gap-8">
            <p className="font-sans font-medium text-[20px] leading-[130%] md:text-[26px] md:leading-[120%] md:tracking-[-0.02em]">
              The rental market never slows down — and neither do we.{" "}
              <span className="text-white/40">
                Our team handles everything from tenant placement to monthly
                reporting so you can collect checks, not calls.
              </span>
            </p>

            <div>
              <MotionLink
                href="/contact"
                animate={PULSE_ANIMATE}
                transition={PULSE_TRANSITION}
                whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
                className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-sans text-sm font-medium text-[#1B1B1B]"
              >
                Get a Free Consultation →
              </MotionLink>
            </div>
          </motion.div>
        </div>

        {/* Cards grid */}
        <div className="manage-cards-grid grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-[20px] mt-16 md:mt-[80px]">
          {CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              {...fadeUp(0.1 + i * 0.08)}
              className="manage-card relative overflow-hidden h-[400px] md:h-[470px] rounded-2xl md:rounded-xl grid content-end gap-5 p-8 md:p-[50px]"
            >
              {/* Background image */}
              <div className="absolute inset-0">
                <img
                  src={card.image}
                  alt={card.title}
                  className="w-full h-full object-cover scale-[1.01]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" />
              </div>

              {/* Title */}
              <h3 className="relative font-sans font-medium text-[28px] leading-[115%] tracking-[-0.01em] max-w-[85%] md:text-[42px] md:tracking-[-0.02em]">
                {card.title}
              </h3>

              {/* Body — visible on mobile always, fade-in on hover for desktop */}
              <p className="card-body-text relative font-sans text-sm leading-relaxed text-white/75 md:text-base">
                {card.body}
              </p>

              {/* Learn More button */}
              <div className="relative">
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/20 backdrop-blur-sm px-6 py-3 font-sans text-sm font-medium text-white hover:border-white/70 transition-colors"
                >
                  Learn More →
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
