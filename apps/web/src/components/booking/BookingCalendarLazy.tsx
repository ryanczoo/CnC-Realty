"use client";
import dynamic from "next/dynamic";
import { CalendarSkeleton } from "./CalendarFrame";

// The only booking-calendar export pages import: the calendar code loads after
// the page, in its own chunk, so it never adds to the page's first-load JS.
// The skeleton is the same fixed-height card, so nothing jumps when it swaps in.
const BookingCalendarLazy = dynamic(() => import("./BookingCalendar"), {
  ssr: false,
  loading: () => <CalendarSkeleton />,
});

export default BookingCalendarLazy;
export { BookingCalendarLazy };
export type { CalendarMode } from "./BookingCalendar";
