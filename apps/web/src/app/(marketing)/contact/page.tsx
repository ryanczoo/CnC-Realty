"use client";
import { useState } from "react";

export default function ContactPage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", notes: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "WEBSITE" }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      setForm({ firstName: "", lastName: "", email: "", phone: "", notes: "" });
    } catch {
      setStatus("error");
    }
  }

  const field = (name: keyof typeof form, label: string, type = "text", required = false) => (
    <div className="flex flex-col gap-1.5">
      <label className="font-sans text-sm text-[#1B1B1B]/60">{label}{required && " *"}</label>
      <input
        type={type}
        required={required}
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        className="border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
      />
    </div>
  );

  return (
    <main className="min-h-screen bg-[#F2F0EF] px-8 pb-24 pt-32 lg:px-20">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-2 font-sans text-[3rem] font-light leading-tight text-[#1B1B1B]">
          Get in touch.
        </h1>
        <p className="mb-12 font-sans text-base text-[#1B1B1B]/50">
          Send us a message and a CnC agent will reach out within 24 hours.
        </p>

        {status === "success" ? (
          <div className="rounded-2xl bg-white p-8 text-center">
            <p className="font-sans text-lg font-light text-[#1B1B1B]">Message received.</p>
            <p className="mt-2 font-sans text-sm text-[#1B1B1B]/50">We&apos;ll be in touch soon.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            <div className="grid grid-cols-2 gap-6">
              {field("firstName", "First Name", "text", true)}
              {field("lastName", "Last Name", "text", true)}
            </div>
            {field("email", "Email", "email", true)}
            {field("phone", "Phone (optional)")}
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-sm text-[#1B1B1B]/60">Message</label>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="resize-none border-b border-[#1B1B1B]/20 bg-transparent py-2 font-sans text-base text-[#1B1B1B] outline-none transition-colors focus:border-[#1B1B1B]/60"
              />
            </div>
            {status === "error" && (
              <p className="font-sans text-sm text-red-500">Something went wrong. Please try again.</p>
            )}
            <button
              type="submit"
              disabled={status === "loading"}
              className="self-start rounded-full bg-[#1B1B1B] px-8 py-3.5 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {status === "loading" ? "Sending…" : "Send Message"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
