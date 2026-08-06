import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { AnnouncementComposer } from "./AnnouncementComposer";

export const metadata = { title: "Announcements | CnC Realty" };

export default async function AnnouncementsPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  let announcements: { id: string; title: string; body: string; sentAt: Date | null }[] = [];

  try {
    announcements = await prisma.announcement.findMany({
      where: { sentAt: { not: null } },
      orderBy: { sentAt: "desc" },
      take: 100,
    });
  } catch {
    // DB unreachable — show empty state
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-medium text-[#1B1B1B]">Announcements</h1>
        {isAdmin && <AnnouncementComposer />}
      </div>

      {announcements.length === 0 ? (
        <p className="font-sans text-sm text-[#1B1B1B]/50">No announcements yet.</p>
      ) : (
        <div className="max-w-2xl space-y-4">
          {announcements.map((a) => (
            <div key={a.id} className="rounded-xl border border-[#1B1B1B]/10 bg-white p-6">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-sans text-base font-medium text-[#1B1B1B]">{a.title}</h2>
                <span className="font-sans text-xs text-[#1B1B1B]/40">
                  {a.sentAt ? formatDate(a.sentAt) : ""}
                </span>
              </div>
              <p className="whitespace-pre-wrap font-sans text-sm text-[#1B1B1B]/70">{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
