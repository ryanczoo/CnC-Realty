"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

function UnsubscribeForm() {
  const token = useSearchParams().get("t") ?? "";
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  // Deliberately does NOT unsubscribe on load. Mail scanners and link preview
  // bots fetch URLs found in email; opting out on render would unsubscribe
  // people who never clicked.
  async function confirm() {
    setState("sending");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <>
        <h1 className="font-sans text-[2rem] font-light text-[#1B1B1B]">
          You&apos;re unsubscribed
        </h1>
        <p className="mt-4 text-[#1B1B1B]/70">
          You won&apos;t receive marketing emails from CnC Realty. You&apos;ll still get
          messages about your account and any active transactions.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-sans text-[2rem] font-light text-[#1B1B1B]">Unsubscribe</h1>
      <p className="mt-4 text-[#1B1B1B]/70">
        Stop receiving marketing emails from CnC Realty?
      </p>
      {state === "error" && (
        <p className="mt-4 text-sm text-red-600">
          That link is invalid or expired. Please use the link from a recent email.
        </p>
      )}
      <motion.button
        type="button"
        onClick={confirm}
        disabled={!token || state === "sending"}
        animate={PULSE_ANIMATE}
        transition={PULSE_TRANSITION}
        whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
        className="mt-8 rounded-full bg-[#1B1B1B] px-7 py-3.5 text-white disabled:opacity-50"
      >
        {state === "sending" ? "Unsubscribing…" : "Unsubscribe"}
      </motion.button>
    </>
  );
}

export default function UnsubscribePage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-cnc-bg px-6">
      <div className="max-w-md text-center">
        {/* useSearchParams needs a Suspense boundary or the route opts into
            dynamic rendering at build time. */}
        <Suspense fallback={null}>
          <UnsubscribeForm />
        </Suspense>
      </div>
    </main>
  );
}
