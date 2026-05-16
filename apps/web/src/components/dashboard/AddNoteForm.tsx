"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddNoteForm({ leadId }: { leadId: string }) {
  const [content, setContent] = useState("");
  const [type, setType] = useState("NOTE");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    await fetch(`/api/leads/${leadId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, content }),
    });
    setContent("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex gap-2">
        {["NOTE", "CALL", "EMAIL", "SHOWING"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-full px-3 py-1 font-sans text-xs transition-colors ${
              type === t
                ? "bg-[#1B1B1B] text-white"
                : "bg-[#1B1B1B]/10 text-[#1B1B1B]/60 hover:bg-[#1B1B1B]/20"
            }`}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <textarea
        rows={3}
        placeholder="Add a note…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full resize-none rounded-xl border border-[#1B1B1B]/15 bg-white p-3 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#1B1B1B]/40"
      />
      <button
        type="submit"
        disabled={loading || !content.trim()}
        className="self-start rounded-full bg-[#1B1B1B] px-5 py-2 font-sans text-xs font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        {loading ? "Saving…" : "Add"}
      </button>
    </form>
  );
}
