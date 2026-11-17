// The fixed-height white card every calendar state renders in (loading,
// loaded, unavailable), so swapping between them never moves the page.
export const CARD_CLS =
  "flex h-[640px] flex-col rounded-2xl bg-white p-8 font-sans text-[#1B1B1B] shadow-floating max-lg:p-5 lg:h-[540px]";

// The one calendar heading, used on every page the calendar appears. Styled like the Buy
// page's "One stop / SHOP" title: "Meet with" light, then a gold "RYAN" in the second
// column so it sits directly under "with". The block and the subtitle are centered.
const LINE_ONE = "text-[1.6rem] max-lg:text-[1.4rem]";

export function CalendarHeader() {
  return (
    <div className="mb-6 max-lg:mb-4">
      <h2 className="mx-auto grid w-fit grid-cols-[auto_auto] gap-x-[0.4rem] font-light leading-[1.05]">
        <span className={LINE_ONE}>Meet</span>{" "}
        <span className={`col-start-2 ${LINE_ONE}`}>with</span>{" "}
        <span className="col-start-2 text-[2.1rem] font-medium text-cnc-gold max-lg:text-[1.8rem]">RYAN</span>
      </h2>
      <p className="mt-1 text-center text-sm text-[#1B1B1B]/50">by phone or Google Meet</p>
    </div>
  );
}

/** Loading placeholder: same card, same real heading, grey shapes where the grid and times go. */
export function CalendarSkeleton() {
  return (
    <div className={CARD_CLS} aria-busy="true">
      <CalendarHeader />
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:grid lg:grid-cols-[1fr_220px]">
        <div className="h-[300px] animate-pulse rounded-xl bg-[#F2F0EF]" />
        <div className="min-h-0 flex-1 animate-pulse rounded-xl bg-[#F2F0EF] lg:max-h-[360px]" />
      </div>
    </div>
  );
}
