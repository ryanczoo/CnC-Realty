"use client";

import { motion } from "motion/react";
import { SPRING_HOVER } from "@/lib/motion";

interface SortFilterProps {
  sort: "desc" | "asc";
  onToggle: () => void;
}

export function SortFilter({ sort, onToggle }: SortFilterProps) {
  return (
    <motion.button
      onClick={onToggle}
      whileHover={{ scale: 1.05 }}
      transition={SPRING_HOVER}
      className="flex items-center gap-2 rounded-full border border-[#1B1B1B]/20 px-4 py-2 font-sans text-sm text-[#1B1B1B]/70 transition-colors hover:border-[#1B1B1B]/40 hover:text-[#1B1B1B]"
    >
      <span>{sort === "desc" ? "Newest First" : "Oldest First"}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    </motion.button>
  );
}
