import { BookingCalendarLazy } from "@/components/booking/BookingCalendarLazy";

// Join page "Chat with Ryan" section. The heading lives here, so the calendar
// gets none. The id is the target of the recruiting-email link (/join?book=…#book-a-call).
export function BookACallSection() {
  return (
    <section id="book-a-call" data-navbar-theme="light" className="scroll-mt-24 bg-[#F2F0EF] px-8 py-24 lg:px-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-10 font-sans text-[3.5rem] font-light leading-[1.1] max-lg:text-[clamp(2.2rem,10vw,3.5rem)]">
          Chat with <span className="text-[#9E8C61]">Ryan</span>
        </h2>
        <BookingCalendarLazy mode={{ kind: "book", page: "JOIN" }} />
      </div>
    </section>
  );
}
