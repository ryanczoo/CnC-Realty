"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Deadline {
  transactionId: string;
  address: string;
  label: string;
  date: string;
  daysOut: number;
  agentName: string | null;
  agentEmail: string | null;
}

export function DeadlineAlerts() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/transactions/deadlines", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setDeadlines(data.deadlines ?? []))
      .catch((e) => {
        if (e.name !== "AbortError") console.error("Failed to load deadline alerts:", e);
      });
    return () => controller.abort();
  }, []);

  if (deadlines.length === 0) return null;

  const urgent = deadlines.filter((d) => d.daysOut <= 1);
  const upcoming = deadlines.filter((d) => d.daysOut > 1);

  return (
    <div className="mb-6 space-y-2">
      {urgent.map((d) => (
        <Link
          key={`${d.transactionId}-${d.label}`}
          href={`/dashboard/transactions/transaction/${d.transactionId}`}
          className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 transition-opacity hover:opacity-80"
        >
          <span>
            <strong>{d.label}</strong> deadline for{" "}
            <strong>{d.address}</strong> is{" "}
            {d.daysOut === 0 ? "today" : "tomorrow"}
          </span>
          <span className="ml-4 shrink-0 text-xs text-red-500">View →</span>
        </Link>
      ))}
      {upcoming.map((d) => (
        <Link
          key={`${d.transactionId}-${d.label}`}
          href={`/dashboard/transactions/transaction/${d.transactionId}`}
          className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 transition-opacity hover:opacity-80"
        >
          <span>
            <strong>{d.label}</strong> deadline for{" "}
            <strong>{d.address}</strong> in {d.daysOut} days
          </span>
          <span className="ml-4 shrink-0 text-xs text-amber-500">View →</span>
        </Link>
      ))}
    </div>
  );
}
