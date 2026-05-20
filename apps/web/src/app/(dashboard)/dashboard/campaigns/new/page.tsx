"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TiptapEditor } from "@/components/campaigns/TiptapEditor";
import { RecipientPicker } from "@/components/campaigns/RecipientPicker";

type CampaignType = "EMAIL" | "DRIP";

const STEPS = ["Details", "Content", "Recipients", "Schedule"];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [name, setName] = useState("");
  const [type, setType] = useState<CampaignType>("EMAIL");
  const [subject, setSubject] = useState("");

  // Step 2
  const [body, setBody] = useState("");

  // Step 3
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Step 4
  const [sendNow, setSendNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");

  const canNext = () => {
    if (step === 1) return name.trim().length > 0 && subject.trim().length > 0;
    if (step === 2) return body.trim().length > 0 && body !== "<p></p>";
    if (step === 3) return selectedIds.length > 0;
    return true;
  };

  const handleFinish = async () => {
    setError(null);
    setSubmitting(true);

    try {
      // Create the campaign
      const createRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, subject }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error ?? "Failed to create campaign");
      }

      const campaign = await createRes.json();

      // Save body and add recipients concurrently
      await Promise.all([
        fetch(`/api/campaigns/${campaign.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        }),
        fetch(`/api/campaigns/${campaign.id}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadIds: selectedIds }),
        }),
      ]);

      // Schedule or send
      if (!sendNow && scheduledAt) {
        await fetch(`/api/campaigns/${campaign.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduledAt: new Date(scheduledAt).toISOString(),
            status: "SCHEDULED",
          }),
        });
      } else if (sendNow) {
        await fetch(`/api/campaigns/${campaign.id}/send`, { method: "POST" });
      }

      router.push("/dashboard/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-start justify-center bg-[#F2F0EF] py-10">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="mb-3 flex justify-between">
            {STEPS.map((label, i) => (
              <span
                key={label}
                className={`font-sans text-xs font-medium ${
                  i + 1 <= step ? "text-[#1B1B1B]" : "text-[#1B1B1B]/30"
                }`}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#F2F0EF]">
            <div
              className="h-1.5 rounded-full bg-[#1B1B1B] transition-all duration-300"
              style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Details */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-sans text-xl font-light text-[#1B1B1B]">Campaign Details</h2>
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-sm text-[#1B1B1B]/60">Campaign Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Spring Outreach 2026"
                className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-sm text-[#1B1B1B]/60">Type</label>
              <div className="flex gap-3">
                {(["EMAIL", "DRIP"] as CampaignType[]).map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="type"
                      value={t}
                      checked={type === t}
                      onChange={() => setType(t)}
                      className="accent-[#9E8C61]"
                    />
                    <span className="font-sans text-sm text-[#1B1B1B]">{t}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-sm text-[#1B1B1B]/60">Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
                className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
              />
            </div>
          </div>
        )}

        {/* Step 2: Content */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-sans text-xl font-light text-[#1B1B1B]">Email Content</h2>
            <TiptapEditor value={body} onChange={setBody} />
          </div>
        )}

        {/* Step 3: Recipients */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-sans text-xl font-light text-[#1B1B1B]">Select Recipients</h2>
            <RecipientPicker selectedIds={selectedIds} onChange={setSelectedIds} />
          </div>
        )}

        {/* Step 4: Schedule */}
        {step === 4 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-sans text-xl font-light text-[#1B1B1B]">Schedule</h2>
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#1B1B1B]/10 p-4 hover:bg-[#F2F0EF]">
                <input
                  type="radio"
                  name="schedule"
                  checked={sendNow}
                  onChange={() => setSendNow(true)}
                  className="accent-[#9E8C61]"
                />
                <div>
                  <p className="font-sans text-sm font-medium text-[#1B1B1B]">Send Now</p>
                  <p className="font-sans text-xs text-[#1B1B1B]/50">
                    Campaign will be sent immediately after you click Finish.
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#1B1B1B]/10 p-4 hover:bg-[#F2F0EF]">
                <input
                  type="radio"
                  name="schedule"
                  checked={!sendNow}
                  onChange={() => setSendNow(false)}
                  className="accent-[#9E8C61]"
                />
                <div className="flex-1">
                  <p className="font-sans text-sm font-medium text-[#1B1B1B]">Schedule for Later</p>
                  <p className="font-sans text-xs text-[#1B1B1B]/50">Choose a date and time.</p>
                </div>
              </label>
              {!sendNow && (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61]"
                />
              )}
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 font-sans text-sm text-red-600">{error}</p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
            className="rounded-full border border-[#1B1B1B]/20 px-5 py-2.5 font-sans text-sm text-[#1B1B1B]/60 hover:border-[#1B1B1B]/40 hover:text-[#1B1B1B] disabled:opacity-0 disabled:pointer-events-none transition-colors"
          >
            ← Back
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="rounded-full bg-[#1B1B1B] px-5 py-2.5 font-sans text-sm text-white hover:bg-[#1B1B1B]/80 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting}
              className="rounded-full bg-[#9E8C61] px-5 py-2.5 font-sans text-sm text-white hover:bg-[#9E8C61]/80 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              {submitting ? "Saving…" : sendNow ? "Send Campaign" : "Schedule Campaign"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
