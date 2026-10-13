"use client";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { CARD_LIFT_ANIMATE, CARD_LIFT_CLS, SPRING_HOVER } from "@/lib/motion";

// Wraps the card floating under the mouse or finger: it pops up and tilts with a gold ring, on every screen size.
export function DragLift({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ scale: 1, rotate: 0 }} animate={CARD_LIFT_ANIMATE} transition={SPRING_HOVER} className={CARD_LIFT_CLS}>
      {children}
    </motion.div>
  );
}
