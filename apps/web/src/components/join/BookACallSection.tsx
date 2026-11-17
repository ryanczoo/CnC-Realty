import { BookingCalendarLazy } from "@/components/booking/BookingCalendarLazy";

// Join page "Meet with RYAN" section. The calendar card's own shared heading is the
// section's only title (Ryan, 2026-11-17). The id is the target of the recruiting-email
// link (/join?book=…#book-a-call).
export function BookACallSection() {
  return (
    <section id="book-a-call" data-navbar-theme="light" className="scroll-mt-24 bg-[#F2F0EF] px-8 py-24 lg:px-20">
      <div className="mx-auto max-w-4xl">
        <BookingCalendarLazy mode={{ kind: "book", page: "JOIN" }} />
      </div>
    </section>
  );
}
