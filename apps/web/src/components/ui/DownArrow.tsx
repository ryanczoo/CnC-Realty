"use client";

import { motion } from "motion/react";

export function DownArrow({ className }: { className?: string }) {
  return (
    <motion.div
      className={`absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 ${className ?? ""}`}
      animate={{ y: [0, 8, 0] }}
      transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
    >
      <svg width="28" height="28" viewBox="0 0 30 30" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 20.488c0-.13.053-.253.146-.344l13-13.002c.42-.44 1.174.24.706.707l-13 13c-.302.31-.853.096-.853-.362zM.852 7.142l14 14.002c.447.447-.273 1.16-.707.707l-14-14c-.444-.445.26-1.155.707-.708z" />
      </svg>
    </motion.div>
  );
}
