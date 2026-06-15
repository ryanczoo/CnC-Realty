"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import posthog from "posthog-js";
import { useCookieConsent } from "@/hooks/useCookieConsent";

export function CookieBanner() {
  const { consent, grant, deny } = useCookieConsent();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    if (consent === "granted") {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        person_profiles: "identified_only",
        capture_pageview: true,
        capture_pageleave: true,
      });
    }
  }, [consent]);

  const showBanner = consent === null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-0 left-0 right-0 z-[200] bg-[#1B1B1B] px-6 py-4 shadow-lg"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-sans text-sm text-white/70">
              We use cookies to understand how visitors use our site and improve your experience.{" "}
              <a
                href="/privacy"
                className="underline underline-offset-2 hover:text-white transition-colors"
              >
                Privacy Policy
              </a>
            </p>
            <div className="flex shrink-0 gap-3">
              <button
                onClick={deny}
                className="rounded-full border border-white/20 px-5 py-2 font-sans text-sm text-white/60 hover:text-white transition-colors"
              >
                Decline
              </button>
              <button
                onClick={grant}
                className="rounded-full bg-[#9E8C61] px-5 py-2 font-sans text-sm font-medium text-white hover:bg-[#9E8C61]/80 transition-colors"
              >
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
