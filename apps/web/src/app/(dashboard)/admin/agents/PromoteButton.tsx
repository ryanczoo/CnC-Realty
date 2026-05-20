"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PromoteButton({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handlePromote() {
    setLoading(true);
    try {
      await fetch(`/api/admin/agents/${agentId}/promote`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePromote}
      disabled={loading}
      className="rounded-full border border-[#9E8C61] px-3 py-1 text-xs font-medium text-[#9E8C61] transition-colors hover:bg-[#9E8C61] hover:text-white disabled:opacity-50"
    >
      {loading ? "Promoting…" : "Promote to Admin"}
    </button>
  );
}
