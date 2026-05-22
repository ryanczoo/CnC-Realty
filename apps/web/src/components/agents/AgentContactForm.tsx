"use client";
import { useState } from "react";

export function AgentContactForm({ slug }: { slug: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/agents/${slug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to send");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-xl bg-[#9E8C61]/10 p-6 text-center">
        <p className="font-sans text-base font-medium text-[#9E8C61]">Message sent!</p>
        <p className="mt-1 font-sans text-sm text-[#1B1B1B]/60">
          The agent will be in touch shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="font-sans text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/60">
          Full Name
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="font-sans text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/60">
          Email
        </label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="font-sans text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/60">
          Phone (optional)
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 000-0000"
          className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="font-sans text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/60">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="I'm interested in buying/selling…"
          className="resize-none rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 font-sans text-sm text-red-600">{error}</p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-[#9E8C61] py-3 font-sans text-sm font-medium text-white transition-colors hover:bg-[#9E8C61]/80 disabled:pointer-events-none disabled:opacity-40"
      >
        {submitting ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
