import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { AddNoteForm } from "@/components/dashboard/AddNoteForm";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified",
  SHOWING: "Showing", OFFER: "Offer", UNDER_CONTRACT: "Under Contract",
  CLOSED: "Closed", LOST: "Lost",
};

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  let lead = null;
  try {
    lead = await prisma.lead.findUnique({
      where: { id: params.id },
      include: { activities: { orderBy: { createdAt: "desc" } } },
    });
  } catch {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="font-light text-[#1B1B1B]">Unable to load lead details right now.</p>
          <p className="mt-2 text-sm text-[#1B1B1B]/50">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }
  if (!lead) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/leads" className="mb-6 inline-block font-sans text-sm text-[#1B1B1B]/40 hover:text-[#1B1B1B]">
        ← Back to Leads
      </Link>

      <div className="mb-8 rounded-2xl bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">
              {lead.firstName} {lead.lastName}
            </h1>
            <p className="mt-1 font-sans text-sm text-[#1B1B1B]/50">{lead.email}</p>
            {lead.phone && <p className="font-sans text-sm text-[#1B1B1B]/50">{lead.phone}</p>}
          </div>
          <span className="rounded-full bg-[#9E8C61]/15 px-3 py-1 font-sans text-xs font-medium text-[#9E8C61]">
            {STATUS_LABELS[lead.status] ?? lead.status}
          </span>
        </div>
        {lead.notes && (
          <div className="mt-4 border-t border-[#1B1B1B]/10 pt-4">
            <p className="font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Message</p>
            <p className="mt-1 font-sans text-sm text-[#1B1B1B]/70">{lead.notes}</p>
          </div>
        )}
        <p className="mt-4 font-sans text-xs text-[#1B1B1B]/30">
          Received {new Date(lead.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div className="mb-6 rounded-2xl bg-white p-6">
        <h2 className="mb-4 font-sans text-sm font-medium text-[#1B1B1B]">Add Activity</h2>
        <AddNoteForm leadId={lead.id} />
      </div>

      <div className="rounded-2xl bg-white p-6">
        <h2 className="mb-4 font-sans text-sm font-medium text-[#1B1B1B]">Activity</h2>
        <ActivityFeed
          activities={lead.activities.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
        />
      </div>
    </div>
  );
}
