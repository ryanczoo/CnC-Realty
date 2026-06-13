"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import { fadeUp, PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

const CARDS = [
  {
    title: "Tenant Placement",
    body: "We market your property on CRMLS and major platforms, screen applicants thoroughly, and place qualified tenants fast.",
    image: "https://picsum.photos/seed/handle-tenant/800/600",
    href: "/contact",
  },
  {
    title: "Rent Collection",
    body: "Automated rent collection with direct deposit to your account. Late payments handled professionally so you don't have to.",
    image: "https://picsum.photos/seed/handle-rent/800/600",
    href: "/contact",
  },
  {
    title: "Maintenance Coordination",
    body: "24/7 maintenance request line. We coordinate with licensed vendors, get multiple bids, and keep you informed at every step.",
    image: "https://picsum.photos/seed/handle-maintenance/800/600",
    href: "/contact",
  },
  {
    title: "Financial Reporting",
    body: "Monthly income and expense statements, annual reports for tax prep, and a live owner portal to see everything in real time.",
    image: "https://picsum.photos/seed/handle-financial/800/600",
    href: "/contact",
  },
  {
    title: "Lease Management",
    body: "California-compliant leases, renewals, rent increase notices, and move-out inspections — all handled by our team.",
    image: "https://picsum.photos/seed/handle-lease/800/600",
    href: "/contact",
  },
  {
    title: "Eviction Protection",
    body: "When necessary, we follow California eviction law precisely and work with our legal partners to protect your investment.",
    image: "https://picsum.photos/seed/handle-eviction/800/600",
    href: "/contact",
  },
];

const ROW_1 = CARDS.slice(0, 3);
const ROW_2 = CARDS.slice(3, 6);

function CardRow({ cards, rowClass }: { cards: typeof CARDS; rowClass: string }) {
  return (
    <div className={`${rowClass} grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-[20px]`}>
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          {...fadeUp(0.1 + i * 0.08)}
          className="manage-handle-card relative overflow-hidden h-[400px] md:h-[470px] rounded-2xl md:rounded-xl grid content-end gap-5 p-8 md:p-[50px]"
        >
          <div className="absolute inset-0">
            <img
              src={card.image}
              alt={card.title}
              className="w-full h-full object-cover scale-[1.01]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" />
          </div>
          <h3 className="relative font-sans font-medium text-[28px] leading-[115%] tracking-[-0.01em] max-w-[85%] md:text-[42px] md:tracking-[-0.02em]">
            {card.title}
          </h3>
          <p className="card-handle-text relative font-sans text-sm leading-relaxed text-white/75 md:text-base">
            {card.body}
          </p>
          <div className="relative">
            <motion.div
              animate={PULSE_ANIMATE}
              transition={PULSE_TRANSITION}
              whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
              className="w-fit"
            >
              <Link
                href={card.href}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/20 backdrop-blur-sm px-6 py-3 font-sans text-sm font-medium text-white transition-colors hover:border-white/70"
              >
                Learn More
              </Link>
            </motion.div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function ManageHandle() {
  return (
    <section data-navbar-theme="dark" className="bg-[#1B1B1B] text-white py-24 md:py-[150px] overflow-hidden">
      <style>{`
        .manage-handle-row-1,
        .manage-handle-row-2 {
          transition: grid-template-columns 1s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (min-width: 768px) and (pointer: fine) {
          .manage-handle-row-1:has(.manage-handle-card:nth-child(1):hover) { grid-template-columns: 1.2fr 0.9fr 0.9fr; }
          .manage-handle-row-1:has(.manage-handle-card:nth-child(2):hover) { grid-template-columns: 0.9fr 1.2fr 0.9fr; }
          .manage-handle-row-1:has(.manage-handle-card:nth-child(3):hover) { grid-template-columns: 0.9fr 0.9fr 1.2fr; }
          .manage-handle-row-2:has(.manage-handle-card:nth-child(1):hover) { grid-template-columns: 1.2fr 0.9fr 0.9fr; }
          .manage-handle-row-2:has(.manage-handle-card:nth-child(2):hover) { grid-template-columns: 0.9fr 1.2fr 0.9fr; }
          .manage-handle-row-2:has(.manage-handle-card:nth-child(3):hover) { grid-template-columns: 0.9fr 0.9fr 1.2fr; }
          .manage-handle-card .card-handle-text { opacity: 0; transition: opacity 0.4s ease; }
          .manage-handle-card:hover .card-handle-text { opacity: 1; }
        }
      `}</style>

      <div className="mx-auto max-w-[1920px] px-10 md:px-[100px]">
        <div className="mb-16 flex justify-end">
          <h2 className="font-sans font-light">
            <RevealLine>
              <span className="text-[1.9rem] xl:text-[2.2rem] text-white/80">Our </span>
              <span className="text-cnc-gold font-medium">Services</span>
            </RevealLine>
          </h2>
        </div>

        <CardRow cards={ROW_1} rowClass="manage-handle-row-1" />
        <CardRow cards={ROW_2} rowClass="manage-handle-row-2 mt-3 md:mt-[20px]" />
      </div>
    </section>
  );
}
