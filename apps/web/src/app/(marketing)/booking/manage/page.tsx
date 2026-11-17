import Link from "next/link";
import type { Metadata } from "next";
import { verifyManageToken } from "@/lib/booking/tokens";
import { getManageView } from "@/lib/booking/manage-booking";
import { ManageBooking } from "@/components/booking/ManageBooking";

export const metadata: Metadata = {
  title: "Manage your call",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#F2F0EF] px-8 pb-24 pt-32 lg:px-20">
      <div className="mx-auto max-w-4xl">{children}</div>
    </main>
  );
}

export default async function ManageBookingPage({ searchParams }: { searchParams: { t?: string } }) {
  const token = searchParams.t;
  const bookingId = token ? verifyManageToken(token) : null;
  const view = bookingId ? await getManageView(bookingId).catch(() => null) : null;

  if (!token || !view) {
    return (
      <Shell>
        <div className="font-sans text-[#1B1B1B]">
          <h1 className="text-[2.2rem] font-light leading-tight">This link isn&apos;t valid anymore.</h1>
          <Link href="/contact" className="mt-4 inline-block text-base text-[#9E8C61] hover:underline">
            Book a new time on our contact page
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <ManageBooking token={token} initial={view} />
    </Shell>
  );
}
