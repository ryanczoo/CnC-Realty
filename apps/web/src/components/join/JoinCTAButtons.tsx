"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { SPRING_HOVER, PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";
import { ContactModal } from "@/components/ui/ContactModal";

const MotionLink = motion(Link);

export function JoinCTAButtons() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="flex justify-center gap-4">
        <MotionLink
          href="/join/agent"
          animate={PULSE_ANIMATE}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          transition={PULSE_TRANSITION}
          className="inline-flex items-center rounded-full bg-[#9E8C61] px-8 py-3.5 font-sans text-sm font-medium text-white"
        >
          Join
        </MotionLink>
        <motion.button
          onClick={() => setModalOpen(true)}
          animate={PULSE_ANIMATE}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
          transition={PULSE_TRANSITION}
          className="inline-flex items-center rounded-full border border-[#1B1B1B]/20 px-8 py-3.5 font-sans text-sm font-medium text-[#1B1B1B]"
        >
          Message
        </motion.button>
      </div>

      <ContactModal
        open={modalOpen}
        source="JOIN_CTA"
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
