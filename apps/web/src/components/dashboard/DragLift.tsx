"use client";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { CARD_LIFT_ANIMATE, CARD_LIFT_CLS, SPRING_HOVER } from "@/lib/motion";

// Wraps the card floating under the finger. Lifted (phone touch hold) → it pops up and tilts with a gold ring;
// otherwise (desktop mouse drag) the card renders exactly as before, with no wrapper.
export function DragLift({ lifted, children }: { lifted: boolean; children: ReactNode }) {
  if (!lifted) return <>{children}</>;
  return (
    <motion.div initial={{ scale: 1, rotate: 0 }} animate={CARD_LIFT_ANIMATE} transition={SPRING_HOVER} className={CARD_LIFT_CLS}>
      {children}
    </motion.div>
  );
}
