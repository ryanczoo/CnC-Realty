"use client";
import dynamic from "next/dynamic";
import { useRef, type ComponentProps } from "react";
import { useDeferredReveal } from "@/hooks/useDeferredReveal";
import { CalendarSkeleton } from "./CalendarFrame";

// The calendar code is requested only after the page has loaded and gone idle,
// and only when its spot is near the viewport, so it never adds to the page's
// initial load. The skeleton is the same fixed-height card, so nothing jumps.
const BookingCalendarChunk = dynamic(() => import("./BookingCalendar"), {
  ssr: false,
  loading: () => <CalendarSkeleton />,
});

type Props = ComponentProps<typeof BookingCalendarChunk>;

function BookingCalendarLazy(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reveal = useDeferredReveal(ref);
  return (
    <div ref={ref}>
      {reveal ? <BookingCalendarChunk {...props} /> : <CalendarSkeleton />}
    </div>
  );
}

export default BookingCalendarLazy;
export { BookingCalendarLazy };
export type { CalendarMode } from "./BookingCalendar";
