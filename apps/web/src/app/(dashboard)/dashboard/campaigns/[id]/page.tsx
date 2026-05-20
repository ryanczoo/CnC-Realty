"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CAMPAIGN_STATUS_COLORS, CONTACT_STATUS_COLORS } from "@/lib/campaign-ui";
import { toTitleCase } from "@/lib/utils";

interface ContactRow {
  id: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  lead: { id: string; firstName: string; lastName: string; email: string };
}

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  subject: string | null;
  body: string | null;
  scheduledAt: string | null;
  createdAt: string;
  contacts: ContactRow[];
  _count: { contacts: number };
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; errors: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/campaigns/${id}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setCampaign(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name !== "AbortError") setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  const handleSend = async () => {
    if (!confirm("Send this campaign to all pending recipients now?")) return;
    setSending(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, { method: "POST" });
      const data = await res.json();
      setSendResult(data);
      const updated = await fetch(`/api/campaigns/${id}`).then((r) => r.json());
      setCampaign(updated);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    router.push("/dashboard/campaigns");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[#F2F0EF]" />
        <div className="h-48 animate-pulse rounded-xl bg-[#F2F0EF]" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <p className="font-sans text-[#1B1B1B]/40">Campaign not found.</p>
        <Link href="/dashboard/campaigns" className="mt-4 font-sans text-sm text-[#9E8C61] hover:underline">
          ← Back to Campaigns
        </Link>
      </div>
    );
  }

  const sentCount = campaign.contacts.filter((c) => c.status !== "PENDING").length;
  const openedCount = campaign.contacts.filter((c) => ["OPENED", "CLICKED"].includes(c.status)).length;
  const clickedCount = campaign.contacts.filter((c) => c.status === "CLICKED").length;
  const canSend = campaign.status === "DRAFT" && campaign.contacts.some((c) => c.status === "PENDING");

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard/campaigns"
            className="font-sans text-xs text-[#1B1B1B]/40 hover:text-[#1B1B1B]"
          >
            ← Campaigns
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">{campaign.name}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                CAMPAIGN_STATUS_COLORS[campaign.status] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {toTitleCase(campaign.status)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canSend && (
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="rounded-full bg-[#9E8C61] px-4 py-2 font-sans text-sm text-white hover:bg-[#9E8C61]/80 disabled:opacity-40 transition-colors"
            >
              {sending ? "Sending…" : "Send Now"}
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-full border border-red-200 px-4 py-2 font-sans text-sm text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Send result */}
      {sendResult && (
        <div className="rounded-xl bg-green-50 px-5 py-4 font-sans text-sm text-green-700">
          Sent to {sendResult.sent} recipient{sendResult.sent !== 1 ? "s" : ""}.
          {sendResult.errors > 0 && ` ${sendResult.errors} failed.`}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total Recipients", value: campaign._count.contacts },
          { label: "Sent", value: sentCount },
          { label: "Opened", value: openedCount },
          { label: "Clicked", value: clickedCount },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="font-sans text-2xl font-light text-[#1B1B1B]">{value}</p>
            <p className="mt-1 font-sans text-xs text-[#1B1B1B]/50">{label}</p>
          </div>
        ))}
      </div>

      {/* Campaign details */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-sans text-sm font-medium text-[#1B1B1B]/60 uppercase tracking-wider">
          Campaign Details
        </h2>
        <dl className="flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <dt className="w-28 shrink-0 font-sans text-sm text-[#1B1B1B]/50">Subject</dt>
            <dd className="font-sans text-sm text-[#1B1B1B]">{campaign.subject ?? "—"}</dd>
          </div>
          <div className="flex items-start gap-4">
            <dt className="w-28 shrink-0 font-sans text-sm text-[#1B1B1B]/50">Type</dt>
            <dd className="font-sans text-sm text-[#1B1B1B]">{campaign.type}</dd>
          </div>
          {campaign.scheduledAt && (
            <div className="flex items-start gap-4">
              <dt className="w-28 shrink-0 font-sans text-sm text-[#1B1B1B]/50">Scheduled</dt>
              <dd className="font-sans text-sm text-[#1B1B1B]">
                {new Date(campaign.scheduledAt).toLocaleString()}
              </dd>
            </div>
          )}
        </dl>
        {campaign.body && (
          <div className="mt-5 border-t border-[#1B1B1B]/5 pt-5">
            <p className="mb-3 font-sans text-sm text-[#1B1B1B]/50">Body Preview</p>
            <div
              className="prose prose-sm max-w-none font-sans text-sm text-[#1B1B1B]"
              dangerouslySetInnerHTML={{ __html: campaign.body }}
            />
          </div>
        )}
      </div>

      {/* Contacts table */}
      {campaign.contacts.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1B1B1B]/5">
            <h2 className="font-sans text-sm font-medium text-[#1B1B1B]/60 uppercase tracking-wider">
              Recipients
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1B1B1B]/5">
                  <th className="px-6 py-3 text-left font-sans text-xs font-medium text-[#1B1B1B]/40 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left font-sans text-xs font-medium text-[#1B1B1B]/40 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left font-sans text-xs font-medium text-[#1B1B1B]/40 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left font-sans text-xs font-medium text-[#1B1B1B]/40 uppercase tracking-wider">
                    Sent At
                  </th>
                </tr>
              </thead>
              <tbody>
                {campaign.contacts.map((contact) => (
                  <tr key={contact.id} className="border-b border-[#1B1B1B]/5 last:border-0 hover:bg-[#F2F0EF]/50">
                    <td className="px-6 py-4 font-sans text-sm text-[#1B1B1B]">
                      {contact.lead.firstName} {contact.lead.lastName}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-[#1B1B1B]/60">
                      {contact.lead.email}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-sans text-xs font-medium ${
                          CONTACT_STATUS_COLORS[contact.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {toTitleCase(contact.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-[#1B1B1B]/50">
                      {contact.sentAt
                        ? new Date(contact.sentAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
