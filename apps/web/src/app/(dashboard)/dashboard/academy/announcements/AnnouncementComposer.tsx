"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "closed" | "compose" | "confirm";

export function AnnouncementComposer() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("closed");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("closed");
    setTitle("");
    setBody("");
    setDraftId(null);
    setError(null);
  }

  async function handleCreateDraft() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setDraftId(data.id);
      setStep("confirm");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!draftId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/announcements/${draftId}/send`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong");
        return;
      }
      reset();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (step === "closed") {
    return (
      <button
        onClick={() => setStep("compose")}
        className="rounded-full bg-[#9E8C61] px-5 py-2.5 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8a7852]"
      >
        + New Announcement
      </button>
    );
  }

  if (step === "compose") {
    return (
      <div className="mb-8 rounded-xl border border-[#1B1B1B]/10 bg-white p-6">
        <h2 className="mb-4 font-sans text-lg font-medium text-[#1B1B1B]">New Announcement</h2>
        <div className="mb-4">
          <label className="mb-1 block font-sans text-xs font-medium text-[#1B1B1B]/60">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-[#1B1B1B]/15 px-3 py-2 font-sans text-sm text-[#1B1B1B] focus:border-[#9E8C61] focus:outline-none"
          />
        </div>
        <div className="mb-4">
          <label className="mb-1 block font-sans text-xs font-medium text-[#1B1B1B]/60">
            Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-[#1B1B1B]/15 px-3 py-2 font-sans text-sm text-[#1B1B1B] focus:border-[#9E8C61] focus:outline-none"
          />
        </div>
        {error && <p className="mb-4 font-sans text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleCreateDraft}
            disabled={loading || !title.trim() || !body.trim()}
            className="rounded-full bg-[#9E8C61] px-5 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8a7852] disabled:opacity-50"
          >
            {loading ? "Saving…" : "Continue"}
          </button>
          <button
            onClick={reset}
            disabled={loading}
            className="rounded-full border border-[#1B1B1B]/15 px-5 py-2 font-sans text-sm font-medium text-[#1B1B1B] transition-colors hover:bg-[#F2F0EF]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-xl border border-[#9E8C61]/40 bg-white p-6">
      <h2 className="mb-2 font-sans text-lg font-medium text-[#1B1B1B]">Ready to Send?</h2>
      <p className="mb-4 font-sans text-sm text-[#1B1B1B]/60">
        This will email every current agent and publish it to the Announcements archive.
      </p>
      <div className="mb-4 rounded-lg bg-[#F2F0EF] p-4">
        <p className="mb-1 font-sans text-sm font-medium text-[#1B1B1B]">{title}</p>
        <p className="whitespace-pre-wrap font-sans text-sm text-[#1B1B1B]/70">{body}</p>
      </div>
      {error && <p className="mb-4 font-sans text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={handleSend}
          disabled={loading}
          className="rounded-full bg-[#9E8C61] px-5 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8a7852] disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send to All Agents"}
        </button>
        <button
          onClick={reset}
          disabled={loading}
          className="rounded-full border border-[#1B1B1B]/15 px-5 py-2 font-sans text-sm font-medium text-[#1B1B1B] transition-colors hover:bg-[#F2F0EF]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
