"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ApplicationDetail = {
  id: string; status: string; createdAt: string;
  firstName: string; lastName: string; email: string; phone: string;
  address: string; city: string; state: string; zip: string; dateOfBirth: string;
  licenseNumber: string; licenseType: string; licenseExpDate: string;
  yearsLicensed: number; formerBrokerage: string; boardOfRealtors: string | null;
  mlsId: string | null; hasActiveListings: boolean; hasActiveSales: boolean;
  commissionEntity: string;
  hasDisciplinaryHistory: boolean; disciplinaryExplain: string | null;
  hasInvestigationHistory: boolean; investigationExplain: string | null;
  backgroundCheckConsent: boolean; drePerJuryCert: boolean;
  specialties: string[]; bio: string | null;
  icaOpenedAt: string; icaAgreedAt: string; submissionIp: string;
  reviewedBy: string | null; reviewedAt: string | null; rejectionReason: string | null;
};

const ENTITY_LABELS: Record<string, string> = {
  PERSONAL: "Personal Account", LLC: "LLC", S_CORP: "S Corporation", C_CORP: "C Corporation",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 border-b border-[#1B1B1B]/5">
      <span className="w-48 shrink-0 text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/40">{label}</span>
      <span className="text-sm text-[#1B1B1B]/80">{value ?? "—"}</span>
    </div>
  );
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/agent-applications/${id}`)
      .then((r) => r.json())
      .then((d) => setApp(d))
      .catch(() => setApp(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApprove = async () => {
    if (!confirm("Approve this application and create the agent account?")) return;
    setActing(true); setActionError(null);
    const res = await fetch(`/api/agent-applications/${id}/approve`, { method: "POST" });
    if (res.ok) { router.push("/admin/applications"); }
    else { const d = await res.json(); setActionError(d.error); setActing(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { setActionError("Please enter a rejection reason."); return; }
    setActing(true); setActionError(null);
    const res = await fetch(`/api/agent-applications/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    if (res.ok) { router.push("/admin/applications"); }
    else { const d = await res.json(); setActionError(d.error); setActing(false); }
  };

  if (loading) return <div className="py-12 text-center text-sm text-[#1B1B1B]/40">Loading…</div>;
  if (!app) return <div className="py-12 text-center text-sm text-red-500">Application not found.</div>;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">
          {app.firstName} {app.lastName}
        </h1>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
          app.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
          app.status === "APPROVED" ? "bg-green-100 text-green-800" :
          "bg-red-100 text-red-800"
        }`}>{app.status}</span>
      </div>

      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm space-y-0">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">Personal</p>
        <Row label="Email" value={app.email} />
        <Row label="Phone" value={app.phone} />
        <Row label="Address" value={`${app.address}, ${app.city}, ${app.state} ${app.zip}`} />
        <Row label="Date of Birth" value={app.dateOfBirth} />

        <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">License</p>
        <Row label="DRE License #" value={app.licenseNumber} />
        <Row label="License Type" value={app.licenseType === "SALESPERSON" ? "Salesperson" : "Broker Associate"} />
        <Row label="Expiration Date" value={app.licenseExpDate} />
        <Row label="Years Licensed" value={app.yearsLicensed} />
        <Row label="Former Brokerage" value={app.formerBrokerage} />
        <Row label="Board of Realtors" value={app.boardOfRealtors} />
        <Row label="MLS ID" value={app.mlsId} />

        <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">Transfers</p>
        <Row label="Active Listings" value={app.hasActiveListings ? "Yes" : "No"} />
        <Row label="Pending Sales" value={app.hasActiveSales ? "Yes" : "No"} />

        <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">Tax / Business</p>
        <Row label="Commission Entity" value={ENTITY_LABELS[app.commissionEntity] ?? app.commissionEntity} />

        <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">Background</p>
        <Row label="Disciplinary History" value={app.hasDisciplinaryHistory ? `Yes — ${app.disciplinaryExplain}` : "No"} />
        <Row label="DRE Investigation" value={app.hasInvestigationHistory ? `Yes — ${app.investigationExplain}` : "No"} />
        <Row label="Background Check Consent" value={app.backgroundCheckConsent ? "Yes" : "No"} />
        <Row label="DRE Perjury Cert" value={app.drePerJuryCert ? "Certified" : "No"} />

        <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">ICA Audit Trail</p>
        <Row label="ICA Opened At" value={new Date(app.icaOpenedAt).toLocaleString()} />
        <Row label="ICA Agreed At" value={new Date(app.icaAgreedAt).toLocaleString()} />
        <Row label="Submission IP" value={app.submissionIp} />

        {app.specialties.length > 0 && (
          <>
            <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">Profile</p>
            <Row label="Specialties" value={app.specialties.join(", ")} />
            {app.bio && <Row label="Bio" value={app.bio} />}
          </>
        )}

        {app.status !== "PENDING" && (
          <>
            <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-[#9E8C61]">Review</p>
            <Row label="Reviewed By" value={app.reviewedBy} />
            <Row label="Reviewed At" value={app.reviewedAt ? new Date(app.reviewedAt).toLocaleString() : null} />
            {app.rejectionReason && <Row label="Rejection Reason" value={app.rejectionReason} />}
          </>
        )}
      </div>

      {app.status === "PENDING" && (
        <div className="space-y-3">
          {actionError && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{actionError}</p>
          )}
          <button
            onClick={handleApprove}
            disabled={acting}
            className="w-full rounded-full bg-[#9E8C61] py-3 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8a7a52] disabled:opacity-60"
          >
            Approve & Create Account
          </button>
          {!showReject ? (
            <button
              onClick={() => setShowReject(true)}
              className="w-full rounded-full border border-red-200 py-3 font-sans text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              Reject
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                className="w-full rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                rows={3}
                placeholder="Reason for rejection (sent to applicant)…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={acting}
                  className="flex-1 rounded-full bg-red-500 py-3 font-sans text-sm font-medium text-white disabled:opacity-60"
                >
                  Confirm Rejection
                </button>
                <button
                  onClick={() => setShowReject(false)}
                  className="rounded-full border border-[#1B1B1B]/15 px-6 py-3 font-sans text-sm text-[#1B1B1B]/60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
