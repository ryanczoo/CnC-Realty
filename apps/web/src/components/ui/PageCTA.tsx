"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import { CTALineArt } from "@/components/join/CTALineArt";
import { ContactModal } from "@/components/ui/ContactModal";
import { SPRING_HOVER, PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";

const MotionLink = motion(Link);

function CTAButton({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return (
    <MotionLink
      href={href}
      animate={PULSE_ANIMATE}
      whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
      transition={PULSE_TRANSITION}
      className={className}
    >
      {children}
    </MotionLink>
  );
}

interface PageCTAProps {
  heading: React.ReactNode;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  secondaryClassName?: string;
  showContactModal?: boolean;
  contactSource?: string;
}

export function PageCTA({
  heading,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  secondaryClassName = "inline-flex items-center rounded-full border border-[#1B1B1B]/20 px-8 py-3.5 font-sans text-sm font-medium text-[#1B1B1B]",
  showContactModal = false,
  contactSource = "WEBSITE_CTA",
}: PageCTAProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section data-navbar-theme="light" className="relative overflow-hidden bg-[#F2F0EF] px-8 py-28 lg:px-20">
      <CTALineArt />
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <h2 className="mb-4 font-sans text-[2.5rem] font-light leading-tight">
          <RevealLine>{heading}</RevealLine>
        </h2>
        <p className="mb-10 font-sans text-base text-[#1B1B1B]/60">{body}</p>
        <div className="flex justify-center gap-4">
          <CTAButton href={primaryHref} className="inline-flex items-center rounded-full bg-[#9E8C61] px-8 py-3.5 font-sans text-sm font-medium text-white">
            {primaryLabel}
          </CTAButton>
          {secondaryLabel && (
            showContactModal ? (
              <motion.button
                onClick={() => setModalOpen(true)}
                animate={PULSE_ANIMATE}
                whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
                transition={PULSE_TRANSITION}
                className={secondaryClassName}
              >
                {secondaryLabel}
              </motion.button>
            ) : secondaryHref ? (
              <CTAButton href={secondaryHref} className={secondaryClassName}>
                {secondaryLabel}
              </CTAButton>
            ) : null
          )}
        </div>
      </div>

      <ContactModal
        open={modalOpen}
        source={contactSource}
        onClose={() => setModalOpen(false)}
      />
    </section>
  );
}
