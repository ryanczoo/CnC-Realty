"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { emailError, formatPhoneInput } from "@/lib/form-validation";
import { formatSlotPT } from "@/lib/booking/format";
import { ModalShell } from "@/components/ui/ModalShell";
import { UnderlineField } from "@/components/ui/UnderlineField";
import { RoleSelect } from "@/components/ui/RoleSelect";
import { ContactConsentNotice } from "@/components/ui/ContactConsentNotice";
import { RequiredMark } from "@/components/ui/RequiredMark";

export type MeetingType = "PHONE" | "MEET";
export type Prefill = { firstName: string; lastName: string; email: string };
type Booked = { startsAt: string; meetingType: MeetingType; manageUrl: string };

const MEETING_OPTIONS: { value: MeetingType; label: string }[] = [
  { value: "PHONE", label: "Phone call" },
  { value: "MEET", label: "Google Meet" },
];

export const PILL_HOVER = { scale: 1.05, transition: SPRING_HOVER };

/** The confirmation shown inside the pop-up after a successful booking. */
export function BookingSuccess({ startsAt, meetingType, manageUrl }: Booked) {
  return (
    <div className="py-6 text-center font-sans text-[#1B1B1B]">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#9E8C61] text-2xl text-white">✓</div>
      <h2 className="text-[1.6rem] font-light leading-tight">You&apos;re booked!</h2>
      <p className="mt-2 text-sm text-[#1B1B1B]/60">
        {`${formatSlotPT(new Date(startsAt))} · ${meetingType === "MEET" ? "Google Meet" : "Phone call"}`}
      </p>
      <p className="mx-auto mt-2 max-w-xs text-sm text-[#1B1B1B]/50">A calendar invite is on its way to your email.</p>
      <div className="mt-6 flex justify-center gap-6 text-sm">
        <a href={manageUrl} className="text-[#9E8C61] hover:underline">Reschedule</a>
        <a href={manageUrl} className="text-[#9E8C61] hover:underline">Cancel</a>
      </div>
    </div>
  );
}

interface BookingModalProps {
  /** ISO start of the chosen slot; null = closed. */
  slot: string | null;
  page: "CONTACT" | "JOIN";
  prefill: Prefill | null;
  recruitToken: string | null;
  /** booked = true when closing after a successful booking. */
  onClose: (booked: boolean) => void;
  /** The slot was taken between picking and confirming (409). */
  onTaken: () => void;
}

const EMPTY = { firstName: "", lastName: "", email: "", phone: "", role: "", notes: "" };

/** Recruiting-link prefill goes only into empty fields, so it never overwrites what the visitor typed. */
export function mergePrefill<T extends Record<string, string>>(form: T, prefill: Partial<T> | null): T {
  if (!prefill) return form;
  const next = { ...form };
  for (const k of Object.keys(prefill) as (keyof T)[]) {
    if (!next[k] && prefill[k]) next[k] = prefill[k] as T[keyof T];
  }
  return next;
}

function errorFor(status: number, apiError?: string): string {
  if (status === 400 && apiError) return apiError;
  if (status === 503) return "Booking is unavailable right now. Please try again in a bit.";
  if (status === 429) return "Too many tries. Please wait a minute and try again.";
  return "Something went wrong. Please try again.";
}

// Option B pop-up: chosen time chip, the booking form, then the confirmation.
export function BookingModal({ slot, page, prefill, recruitToken, onClose, onTaken }: BookingModalProps) {
  const [form, setForm] = useState(EMPTY);
  const [meetingType, setMeetingType] = useState<MeetingType>("MEET");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorText, setErrorText] = useState("");
  const [roleError, setRoleError] = useState(false);
  const [booked, setBooked] = useState<(Booked & { slot: string }) | null>(null);
  // Keep the last slot on screen while the pop-up animates closed.
  const lastSlot = useRef<string | null>(null);
  if (slot) lastSlot.current = slot;
  const shownSlot = slot ?? lastSlot.current;
  // Success belongs to the slot it was booked for, so reopening on a new time shows the form.
  const showSuccess = booked !== null && booked.slot === shownSlot;

  // Each newly opened slot starts clean, except what the visitor already typed
  // (picking a different time after a "taken" shouldn't wipe their details) and
  // the recruiting-link prefill.
  useEffect(() => {
    if (!slot) return;
    setForm((f) => mergePrefill(f, prefill));
    setStatus("idle");
    setRoleError(false);
  }, [slot, prefill]);

  const set = (k: keyof typeof EMPTY) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const close = () => {
    const wasBooked = showSuccess;
    if (wasBooked) setForm(EMPTY);
    onClose(wasBooked);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return;
    if (!form.role) { setRoleError(true); return; }
    setStatus("loading");
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: slot,
          ...form,
          notes: form.notes || undefined,
          meetingType,
          page,
          ...(recruitToken ? { recruitToken } : {}),
        }),
      });
      if (res.status === 409) { setStatus("idle"); onTaken(); return; }
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setBooked({ slot, startsAt: data.startsAt, meetingType: data.meetingType, manageUrl: data.manageUrl });
        setStatus("idle");
        return;
      }
      setErrorText(errorFor(res.status, data.error));
      setStatus("error");
    } catch {
      setErrorText(errorFor(0));
      setStatus("error");
    }
  }

  return (
    <ModalShell open={slot !== null} onClose={close} label="Book a call" fullScreenOnMobile>
      {showSuccess && booked ? (
        <BookingSuccess startsAt={booked.startsAt} meetingType={booked.meetingType} manageUrl={booked.manageUrl} />
      ) : shownSlot ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 font-sans text-[#1B1B1B] max-lg:gap-3">
          <span className="self-start rounded-full bg-[#F2F0EF] px-4 py-1.5 text-sm">{formatSlotPT(new Date(shownSlot))}</span>

          <div className="grid grid-cols-2 gap-4 max-lg:gap-3">
            <UnderlineField className="flex min-w-0 flex-col gap-1.5 max-lg:gap-1" label="First Name" value={form.firstName} onChange={set("firstName")} />
            <UnderlineField className="flex min-w-0 flex-col gap-1.5 max-lg:gap-1" label="Last Name" value={form.lastName} onChange={set("lastName")} />
          </div>
          <UnderlineField label="Email" type="email" value={form.email} onChange={set("email")} error={emailError(form.email)} />
          <UnderlineField label="Phone" type="tel" value={form.phone} onChange={(v) => set("phone")(formatPhoneInput(v))} />
          <RoleSelect value={form.role} onChange={set("role")} error={roleError} onOpen={() => setRoleError(false)} />

          <div className="flex flex-col gap-2">
            <span className="text-left text-sm text-[#1B1B1B]/60">How should we meet?<RequiredMark /></span>
            <div className="flex gap-2" role="group" aria-label="How should we meet?">
              {MEETING_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setMeetingType(o.value)}
                  aria-pressed={meetingType === o.value}
                  className={`flex-1 rounded-full py-2 text-sm transition-colors ${
                    meetingType === o.value ? "bg-[#1B1B1B] text-white" : "border border-[#1B1B1B]/15 hover:border-[#1B1B1B]/50"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <UnderlineField label="Message" required={false} multiline rows={3} placeholder="Type away..." value={form.notes} onChange={set("notes")} />

          {status === "error" && <p className="text-sm text-red-500">{errorText}</p>}

          <ContactConsentNotice />

          <motion.button
            type="submit"
            disabled={status === "loading" || !!emailError(form.email)}
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={PILL_HOVER}
            className="w-full rounded-full bg-[#1B1B1B] py-3.5 text-sm font-medium text-white disabled:opacity-40 max-lg:py-3"
          >
            {status === "loading" ? "Booking…" : "Confirm Call"}
          </motion.button>
        </form>
      ) : null}
    </ModalShell>
  );
}
