"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { PHONE_POPUP_FRAME, PHONE_POPUP_PANEL } from "@/lib/dashboard-phone";
import { convertChoiceCards } from "@/lib/convert-choices";
import { OptionCard } from "@/components/ui/OptionCard";
import { XIcon } from "@/components/ui/XIcon";

// The Convert to Transaction pop-up: pick who the transaction represents, then
// Convert. Errors from the convert call show inside the pop-up.
export function ConvertListingModal({
  listingId,
  listingType,
  onConverted,
  onClose,
}: {
  listingId: string;
  listingType: string;
  onConverted: (transactionId: string) => void;
  onClose: () => void;
}) {
  const [side, setSide] = useState("");
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !inFlight.current) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleConvert() {
    if (!side || inFlight.current) return;
    inFlight.current = true;
    setConverting(true);
    setError("");
    try {
      const res = await fetch(`/api/listings/${listingId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionSide: side }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Couldn't convert this listing. Please try again.");
        inFlight.current = false;
        setConverting(false);
        return;
      }
      // Success: stay locked (no reset) until the navigation that follows.
      onConverted(body.transactionFile.id);
    } catch {
      setError("Couldn't convert this listing. Please try again.");
      inFlight.current = false;
      setConverting(false);
    }
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 ${PHONE_POPUP_FRAME}`}>
      <div className={`w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ${PHONE_POPUP_PANEL}`}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-sans text-lg font-light text-[#1B1B1B]">Convert to Transaction</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={converting}
            aria-label="Close"
            className="text-[#1B1B1B]/40 hover:text-[#1B1B1B] disabled:opacity-40"
          >
            <XIcon size={20} />
          </button>
        </div>
        <p className="mb-4 text-sm text-[#1B1B1B]/60">Who will this transaction represent?</p>
        <div className="mb-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {convertChoiceCards(listingType).map((c) => (
            <OptionCard
              key={c.value}
              selected={side === c.value}
              onClick={() => {
                setSide(c.value);
                setError("");
              }}
              label={c.label}
              desc={c.desc}
            />
          ))}
        </div>
        {error && <p className="mb-3 text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <motion.button
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
            onClick={handleConvert}
            disabled={!side || converting}
            className="flex-1 rounded-lg bg-[#9E8C61] py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {converting ? "Converting…" : "Convert"}
          </motion.button>
          <button
            onClick={onClose}
            disabled={converting}
            className="flex-1 rounded-lg border border-[#1B1B1B]/10 py-2 text-sm text-[#1B1B1B]/50 hover:bg-[#F2F0EF] disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
