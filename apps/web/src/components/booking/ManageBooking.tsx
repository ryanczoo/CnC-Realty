"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { formatSlotPT } from "@/lib/booking/format";
import { ModalShell } from "@/components/ui/ModalShell";
import { BookingCalendarLazy } from "./BookingCalendarLazy";

interface ManageBookingProps {
  token: string;
  initial: { status: "ACTIVE" | "CANCELLED"; startsAt: string; meetingType: string; firstName: string };
}

const HOVER = { scale: 1.05, transition: SPRING_HOVER };

// The visitor's own view of their call: time, cancel (with a confirm step), and move it.
export function ManageBooking({ token, initial }: ManageBookingProps) {
  const [status, setStatus] = useState(initial.status);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/booking/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, action: "cancel" }),
      });
      if (!res.ok) throw new Error();
      setStatus("CANCELLED");
      setConfirming(false);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "CANCELLED") {
    return (
      <div className="font-sans text-[#1B1B1B]">
        <h1 className="text-[2.2rem] font-light leading-tight">This call was cancelled.</h1>
        <p className="mt-3 text-base text-[#1B1B1B]/60">Want to talk anyway? You can book a new time on our contact page.</p>
      </div>
    );
  }

  const meeting = initial.meetingType === "MEET" ? "Google Meet" : "Phone call";

  return (
    <div className="font-sans text-[#1B1B1B]">
      <h1 className="text-[2.2rem] font-light leading-tight max-lg:text-[1.9rem]">
        Your call with <span className="text-[#9E8C61]">Ryan</span>
      </h1>
      <p className="mt-3 text-lg">{formatSlotPT(new Date(startsAt))}</p>
      <p className="text-sm text-[#1B1B1B]/50">{meeting}</p>

      <motion.button
        type="button"
        onClick={() => { setError(null); setConfirming(true); }}
        animate={PULSE_ANIMATE}
        transition={PULSE_TRANSITION}
        whileHover={HOVER}
        className="mt-6 rounded-full border border-[#1B1B1B]/30 px-7 py-3 text-sm font-medium"
      >
        Cancel call
      </motion.button>

      <h2 className="mb-6 mt-14 text-[1.6rem] font-light">Pick a new time</h2>
      <BookingCalendarLazy mode={{ kind: "reschedule", token, onDone: setStartsAt }} />

      <ModalShell open={confirming} onClose={() => setConfirming(false)} label="Cancel your call">
        <div className="font-sans text-[#1B1B1B]">
          <h2 className="pr-8 text-[1.4rem] font-light leading-tight">Cancel your call?</h2>
          <p className="mt-2 text-sm text-[#1B1B1B]/60">{formatSlotPT(new Date(startsAt))}</p>
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          <div className="mt-6 flex gap-3">
            <motion.button
              type="button"
              onClick={() => setConfirming(false)}
              animate={PULSE_ANIMATE}
              transition={PULSE_TRANSITION}
              whileHover={HOVER}
              className="flex-1 rounded-full border border-[#1B1B1B]/30 py-3.5 text-sm font-medium"
            >
              Keep it
            </motion.button>
            <motion.button
              type="button"
              onClick={cancel}
              disabled={busy}
              animate={PULSE_ANIMATE}
              transition={PULSE_TRANSITION}
              whileHover={HOVER}
              className="flex-1 rounded-full bg-[#1B1B1B] py-3.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? "Cancelling…" : "Yes, cancel"}
            </motion.button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
