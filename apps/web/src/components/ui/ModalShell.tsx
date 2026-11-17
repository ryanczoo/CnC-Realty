"use client";
import { useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  label: string;
  /** On phones the card fills the whole screen instead of floating under the navbar. */
  fullScreenOnMobile?: boolean;
  children: ReactNode;
}

const BACKDROP_FLOATING = "fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 max-lg:items-start max-lg:pb-4 max-lg:pt-20";
const BACKDROP_FULL = "fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 max-lg:items-start max-lg:p-0";
const CARD_FLOATING = "relative w-full max-w-lg rounded-2xl bg-white p-10 max-lg:max-h-[calc(100dvh-6rem)] max-lg:overflow-y-auto max-lg:p-5";
const CARD_FULL = "relative w-full max-w-lg rounded-2xl bg-white p-10 max-lg:fixed max-lg:inset-0 max-lg:max-w-none max-lg:rounded-none max-lg:overflow-y-auto max-lg:p-5";

// The shared pop-up frame: dimmed backdrop, white card, close button, Escape and click-outside to close.
export function ModalShell({ open, onClose, label, fullScreenOnMobile = false, children }: ModalShellProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog" aria-modal="true" aria-label={label} className={fullScreenOnMobile ? BACKDROP_FULL : BACKDROP_FLOATING}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={fullScreenOnMobile ? CARD_FULL : CARD_FLOATING}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-6 top-6 text-[#1B1B1B]/40 transition-colors hover:text-[#1B1B1B]"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
