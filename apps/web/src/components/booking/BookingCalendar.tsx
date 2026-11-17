"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";
import { formatSlotPT } from "@/lib/booking/format";
import { pacificDate } from "@/lib/booking/slots";
import { BOOKING_RULES } from "@/lib/booking/rules";
import { firstOpenDay, windowMonths, type MonthRef } from "@/lib/booking/month-grid";
import { ModalShell } from "@/components/ui/ModalShell";
import { ContactModal } from "@/components/ui/ContactModal";
import { CARD_CLS, CalendarHeader, CalendarSkeleton } from "./CalendarFrame";
import { MonthGrid } from "./MonthGrid";
import { TimeList } from "./TimeList";
import { BookingModal, PILL_HOVER, type Prefill } from "./BookingModal";

export type CalendarMode =
  | { kind: "book"; page: "CONTACT" | "JOIN" }
  | { kind: "reschedule"; token: string; onDone: (startsAt: string) => void };

interface BookingCalendarProps {
  mode: CalendarMode;
}

type Days = Record<string, string[]>;

const TAKEN = "That time was just taken, please pick another.";
const DAY_MS = 86_400_000;

const monthOf = (ymd: string): MonthRef => ({ year: Number(ymd.slice(0, 4)), month0: Number(ymd.slice(5, 7)) - 1 });
const sameMonth = (a: MonthRef, b: MonthRef) => a.year === b.year && a.month0 === b.month0;

function bookingWindowMonths(): MonthRef[] {
  const now = new Date();
  return windowMonths(pacificDate(now), pacificDate(new Date(now.getTime() + BOOKING_RULES.windowDays * DAY_MS)));
}

export function BookingCalendar({ mode }: BookingCalendarProps) {
  const [status, setStatus] = useState<"loading" | "ok" | "unavailable">("loading");
  const [days, setDays] = useState<Days>({});
  const [months, setMonths] = useState<MonthRef[]>([]);
  const [monthIdx, setMonthIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  // Book mode
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [recruitToken, setRecruitToken] = useState<string | null>(null);
  const [bookSlot, setBookSlot] = useState<string | null>(null);
  // Reschedule mode
  const [moveSlot, setMoveSlot] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Keep the time on screen while the move pop-up animates closed.
  const lastMove = useRef<string | null>(null);
  if (moveSlot) lastMove.current = moveSlot;

  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selected;

  const loadSlots = useCallback(async () => {
    try {
      const res = await fetch("/api/booking/slots", { cache: "no-store" });
      const data = await res.json();
      if (data?.status !== "ok") { setStatus("unavailable"); return; }
      const nextDays: Days = data.days ?? {};
      const ms = bookingWindowMonths();
      const prev = selectedRef.current;
      const day = prev && nextDays[prev]?.length ? prev : firstOpenDay(nextDays);
      setDays(nextDays);
      setMonths(ms);
      setSelected(day);
      const idx = day ? ms.findIndex((m) => sameMonth(m, monthOf(day))) : 0;
      setMonthIdx(Math.max(0, idx));
      setStatus("ok");
    } catch {
      setStatus("unavailable");
    }
  }, []);

  useEffect(() => { void loadSlots(); }, [loadSlots]);

  // Recruiting-email link: ?book=<token> prefills name + email and tags the booking.
  const isBook = mode.kind === "book";
  useEffect(() => {
    if (!isBook) return;
    const t = new URLSearchParams(window.location.search).get("book");
    if (!t) return;
    const controller = new AbortController();
    fetch(`/api/booking/prefill?t=${encodeURIComponent(t)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!p) return;
        setPrefill({ firstName: p.firstName ?? "", lastName: p.lastName ?? "", email: p.email ?? "" });
        setRecruitToken(t);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isBook]);

  const slotTaken = useCallback(() => {
    setBookSlot(null);
    setMoveSlot(null);
    setChosen(null);
    setNotice(TAKEN);
    void loadSlots();
  }, [loadSlots]);

  function pickTime(iso: string) {
    setChosen(iso);
    setNotice(null);
    if (mode.kind === "book") setBookSlot(iso);
    else { setMoveError(null); setMoveSlot(iso); }
  }

  function pickDay(ymd: string) {
    setSelected(ymd);
    setChosen(null);
    setNotice(null);
  }

  function closeBooking(booked: boolean) {
    setBookSlot(null);
    setChosen(null);
    if (booked) void loadSlots();
  }

  async function confirmMove() {
    if (mode.kind !== "reschedule" || !moveSlot) return;
    setMoving(true);
    setMoveError(null);
    try {
      const res = await fetch("/api/booking/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: mode.token, action: "reschedule", startsAt: moveSlot }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMoveSlot(null);
        mode.onDone(data.startsAt ?? moveSlot);
      } else if (res.status === 409 && data.error === "taken") {
        slotTaken();
      } else if (res.status === 409 && data.error === "cancelled") {
        setMoveError("This call was cancelled, so it can't be moved.");
      } else if (res.status === 503) {
        setMoveError("Booking is unavailable right now. Please try again in a bit.");
      } else {
        setMoveError("Something went wrong. Please try again.");
      }
    } catch {
      setMoveError("Something went wrong. Please try again.");
    } finally {
      setMoving(false);
    }
  }

  if (status === "loading") return <CalendarSkeleton />;

  if (status === "unavailable") {
    return (
      <div className={CARD_CLS}>
        <CalendarHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="max-w-xs text-base text-[#1B1B1B]/70">Booking is unavailable right now — send us a message instead</p>
          <motion.button
            type="button"
            onClick={() => setContactOpen(true)}
            animate={PULSE_ANIMATE}
            transition={PULSE_TRANSITION}
            whileHover={PILL_HOVER}
            className="rounded-full bg-[#1B1B1B] px-7 py-3.5 text-sm font-medium text-white"
          >
            Message
          </motion.button>
        </div>
        <ContactModal open={contactOpen} source="BOOKING_FALLBACK" onClose={() => setContactOpen(false)} />
      </div>
    );
  }

  const month = months[monthIdx] ?? (selected ? monthOf(selected) : monthOf(pacificDate(new Date())));
  const slots = selected ? days[selected] ?? [] : [];

  return (
    <div className={CARD_CLS}>
      <CalendarHeader />
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:grid lg:grid-cols-[1fr_220px]">
        <MonthGrid
          month={month}
          days={days}
          selected={selected}
          canPrev={monthIdx > 0}
          canNext={monthIdx < months.length - 1}
          onPrev={() => setMonthIdx((i) => Math.max(0, i - 1))}
          onNext={() => setMonthIdx((i) => Math.min(months.length - 1, i + 1))}
          onSelect={pickDay}
        />
        <div className="min-h-0 flex-1 overflow-y-auto lg:max-h-[360px] lg:pr-1">
          {selected ? (
            <TimeList slots={slots} chosen={chosen} onPick={pickTime} notice={notice} />
          ) : (
            <div className="flex flex-col gap-2">
              {notice && <p className="text-sm text-red-500">{notice}</p>}
              <p className="text-sm text-[#1B1B1B]/50">No open times in the next two weeks.</p>
            </div>
          )}
        </div>
      </div>

      {mode.kind === "book" ? (
        <BookingModal
          slot={bookSlot}
          page={mode.page}
          prefill={prefill}
          recruitToken={recruitToken}
          onClose={closeBooking}
          onTaken={slotTaken}
        />
      ) : (
        <ModalShell
          open={moveSlot !== null}
          onClose={() => { setMoveSlot(null); setChosen(null); }}
          label="Move your call"
        >
          <div className="font-sans text-[#1B1B1B]">
            <h2 className="pr-8 text-[1.4rem] font-light leading-tight">
              Move your call to {lastMove.current ? formatSlotPT(new Date(lastMove.current)) : ""}?
            </h2>
            {moveError && <p className="mt-4 text-sm text-red-500">{moveError}</p>}
            <motion.button
              type="button"
              onClick={confirmMove}
              disabled={moving}
              animate={PULSE_ANIMATE}
              transition={PULSE_TRANSITION}
              whileHover={PILL_HOVER}
              className="mt-6 w-full rounded-full bg-[#1B1B1B] py-3.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {moving ? "Moving…" : "Confirm"}
            </motion.button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

export default BookingCalendar;
