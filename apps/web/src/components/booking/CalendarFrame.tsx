import type { ReactNode } from "react";

// The fixed-height white card every calendar state renders in (loading,
// loaded, unavailable), so swapping between them never moves the page.
export const CARD_CLS =
  "flex h-[640px] flex-col rounded-2xl bg-white p-8 font-sans text-[#1B1B1B] shadow-floating max-lg:p-5 lg:h-[540px]";

export function CalendarHeader({ heading }: { heading?: ReactNode }) {
  return (
    <div className="mb-6 max-lg:mb-4">
      <h2 className="text-[1.6rem] font-light leading-tight max-lg:text-[1.4rem]">{heading ?? "Chat with Ryan"}</h2>
      <p className="mt-1 text-sm text-[#1B1B1B]/50">Phone call or Google Meet</p>
    </div>
  );
}

/** Loading placeholder: same card, same heading block, grey shapes where the grid and times go. */
export function CalendarSkeleton({ heading }: { heading?: ReactNode }) {
  return (
    <div className={CARD_CLS} aria-busy="true">
      {heading ? (
        <CalendarHeader heading={heading} />
      ) : (
        <div className="mb-6 max-lg:mb-4">
          <div className="h-[2rem] w-48 animate-pulse rounded bg-[#F2F0EF] max-lg:h-[1.75rem]" />
          <div className="mt-1 h-5 w-40 animate-pulse rounded bg-[#F2F0EF]" />
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:grid lg:grid-cols-[1fr_220px]">
        <div className="h-[300px] animate-pulse rounded-xl bg-[#F2F0EF]" />
        <div className="min-h-0 flex-1 animate-pulse rounded-xl bg-[#F2F0EF] lg:max-h-[360px]" />
      </div>
    </div>
  );
}
