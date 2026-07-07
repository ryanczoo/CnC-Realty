"use client";

import { useState } from "react";

export function DownloadIcaButton({ agentId }: { agentId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}/signed-ica`);
      if (!res.ok) return;
      const { url } = await res.json();
      window.open(url, "_blank");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded px-2 py-1 text-xs font-medium text-[#9E8C61] transition-colors hover:bg-[#9E8C61]/10 disabled:opacity-40"
    >
      {loading ? "…" : "Download Signed ICA"}
    </button>
  );
}
