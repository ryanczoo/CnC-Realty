"use client";

import { motion } from "motion/react";
import { SaveButton } from "./SaveButton";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { useIsMobile } from "@/hooks/useIsMobile";

interface Props {
  mlsNumber: string;
  /** id of the ContactForm to scroll to */
  targetId: string;
  /** positioning: "shrink-0" inside the popup, "sticky bottom-0 z-30 mt-12" on the full page */
  className?: string;
}

// Phones only (lg:hidden): frosted off-white bar — save heart left,
// "Contact Agent" right, which scrolls to the listing's existing contact form.
export function StickyContactBar({ mlsNumber, targetId, className = "" }: Props) {
  // The bar is CSS-hidden on desktop, but would still mount: its SaveButton
  // would fetch saved listings and the pulse would animate unseen every frame.
  // Server + first client render are desktop (false), so this hydrates cleanly.
  const isMobile = useIsMobile();
  return (
    <div
      className={`flex items-center justify-between gap-3 border-t border-[#1B1B1B]/10 bg-[#F2F0EF]/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden ${className}`}
    >
      {isMobile && <SaveButton mlsNumber={mlsNumber} />}
      <motion.button
        type="button"
        onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })}
        animate={isMobile ? PULSE_ANIMATE : undefined}
        transition={PULSE_TRANSITION}
        whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
        className="rounded-full bg-[#1B1B1B] px-7 py-3 text-sm font-medium text-white"
      >
        Contact Agent
      </motion.button>
    </div>
  );
}
