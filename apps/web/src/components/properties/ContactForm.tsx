"use client";

import { useState } from "react";

interface Props {
  mlsNumber: string;
  address: string;
}

type FormState = "idle" | "loading" | "done" | "error";

export function ContactForm({ mlsNumber, address }: Props) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [state, setState] = useState<FormState>("idle");

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          notes: `Property inquiry: ${address} (MLS# ${mlsNumber})${
            form.notes ? "\n" + form.notes : ""
          }`,
          source: "WEBSITE",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setState("done");
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("[ContactForm]", err);
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl bg-white p-6 text-center">
        <p className="text-lg font-semibold text-[#1B1B1B]">Request sent!</p>
        <p className="mt-2 text-sm text-[#1B1B1B]/60">
          An agent will reach out to you shortly.
        </p>
      </div>
    );
  }

  const inputClass =
    "rounded-lg bg-[#F2F0EF] px-3 py-2 text-sm text-[#1B1B1B] placeholder-[#1B1B1B]/30 outline-none focus:ring-1 focus:ring-[#9E8C61]/50";

  return (
    <div className="rounded-2xl bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#1B1B1B]">
        Request a Tour
      </h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          required
          placeholder="First name"
          value={form.firstName}
          onChange={update("firstName")}
          className={inputClass}
        />
        <input
          required
          placeholder="Last name"
          value={form.lastName}
          onChange={update("lastName")}
          className={inputClass}
        />
        <input
          required
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={update("email")}
          className={inputClass}
        />
        <input
          type="tel"
          placeholder="Phone (optional)"
          value={form.phone}
          onChange={update("phone")}
          className={inputClass}
        />
        <textarea
          rows={3}
          placeholder="Message (optional)"
          value={form.notes}
          onChange={update("notes")}
          className={`resize-none ${inputClass}`}
        />
        {state === "error" && (
          <p className="text-xs text-red-600">Something went wrong. Please try again.</p>
        )}
        <button
          type="submit"
          disabled={state === "loading"}
          className="rounded-full bg-[#9E8C61] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#b09870] disabled:opacity-60"
        >
          {state === "loading" ? "Sending…" : "Contact Agent"}
        </button>
      </form>
    </div>
  );
}
