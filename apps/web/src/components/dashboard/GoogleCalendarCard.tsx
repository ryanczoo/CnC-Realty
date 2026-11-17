"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type GcalStatus = "disconnected" | "connected" | "broken";
type ButtonLabel = "Connect Google Calendar" | "Disconnect" | "Reconnect";

export function googleCardView(
  status: GcalStatus,
  email?: string,
): { line: string; button: ButtonLabel } {
  if (status === "connected") {
    return { line: `✓ Connected as ${email ?? ""}`, button: "Disconnect" };
  }
  if (status === "broken") {
    return { line: "Connection lost — bookings are paused.", button: "Reconnect" };
  }
  return { line: "Lets visitors book 15-min calls on your calendar.", button: "Connect Google Calendar" };
}

const FLASH: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "Connected.", ok: true },
  "wrong-account": { text: "That wasn't ryanchong@cncrealtygroup.com — please pick that account.", ok: false },
  "missing-scope": {
    text: "Google didn't grant calendar access — click Connect again and tick both Calendar boxes.",
    ok: false,
  },
  error: { text: "Couldn't connect to Google. Please try again.", ok: false },
};

// Static on purpose (Ryan, 2026-11-17): matches the Settings page's own Save Changes button.
const BTN = "rounded-full bg-[#1B1B1B] px-6 py-2.5 text-sm text-white transition-opacity hover:opacity-75 disabled:opacity-40";

// Rendered for admins only (the page gates it), so the status query never fires for agents.
export default function GoogleCalendarCard() {
  const queryClient = useQueryClient();
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("gcal");
    if (!g) return;
    if (FLASH[g]) setFlash(FLASH[g]);
    params.delete("gcal");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

  const { data } = useQuery({
    queryKey: ["google-calendar", "status"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/google-calendar/status", { signal });
      if (!res.ok) throw new Error("status failed");
      return (await res.json()) as { status: GcalStatus; email?: string };
    },
    staleTime: 60 * 1000,
  });

  async function disconnect() {
    if (!window.confirm("Disconnect Google Calendar? Visitors won't be able to book calls until you reconnect.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/google-calendar/status", { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      setFlash(null);
      await queryClient.invalidateQueries({ queryKey: ["google-calendar", "status"] });
    } catch {
      setFlash({ text: "Something went wrong. Try again.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  const view = data ? googleCardView(data.status, data.email) : null;

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-[#1B1B1B]">Google Calendar</h2>
      {!view ? (
        <p className="text-xs text-[#1B1B1B]/40">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#1B1B1B]/70">{view.line}</p>
          {flash && <p className={`text-xs ${flash.ok ? "text-green-600" : "text-red-500"}`}>{flash.text}</p>}
          {view.button === "Disconnect" ? (
            <button type="button" onClick={disconnect} disabled={busy} className={`self-start ${BTN}`}>
              {busy ? "Disconnecting…" : view.button}
            </button>
          ) : (
            <Link href="/api/google-calendar/connect" prefetch={false} className={`self-start ${BTN}`}>
              {view.button}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
