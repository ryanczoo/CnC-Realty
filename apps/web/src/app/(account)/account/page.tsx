"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { useSavedProperties } from "@/hooks/useSavedProperties";
import type { PropertyListing } from "@/types/property";

type TourRequest = {
  id: string;
  notes: string | null;
  status: string;
  createdAt: string;
};

const TABS = ["Saved Properties", "Tour Requests"] as const;
type Tab = (typeof TABS)[number];

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-white p-12 text-center shadow-sm">
      <p className="text-[#1B1B1B]/40">{message}</p>
      <Link href="/properties" className="mt-3 inline-block text-sm text-[#9E8C61] hover:underline">
        Browse listings →
      </Link>
    </div>
  );
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { savedSet, toggle } = useSavedProperties();
  const [tab, setTab] = useState<Tab>("Saved Properties");
  const [savedProperties, setSavedProperties] = useState<PropertyListing[]>([]);
  const [tourRequests, setTourRequests] = useState<TourRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.id;
  const role = session?.user?.role;

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;
    if (role !== "BUYER") { router.push("/dashboard"); return; }

    const controller = new AbortController();
    Promise.all([
      fetch("/api/account/saved-properties", { signal: controller.signal }).then((r) => r.json()),
      fetch("/api/account/tour-requests", { signal: controller.signal }).then((r) => r.json()),
    ]).then(([savedData, tourData]) => {
      setSavedProperties(savedData.properties ?? []);
      setTourRequests(tourData.requests ?? []);
      setLoading(false);
    }).catch(() => {});

    return () => controller.abort();
  }, [status, userId, role, router]);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2F0EF]">
        <p className="text-sm text-[#1B1B1B]/40">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F0EF] pb-16 pt-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-light text-[#1B1B1B]">
            Welcome back,{" "}
            <span className="font-medium">{session?.user.name ?? "there"}</span>
          </h1>
          <p className="mt-1 text-sm text-[#1B1B1B]/50">{session?.user.email}</p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-2xl font-semibold text-[#1B1B1B]">{savedProperties.length}</p>
            <p className="mt-1 text-sm text-[#1B1B1B]/50">Saved Properties</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-2xl font-semibold text-[#1B1B1B]">{tourRequests.length}</p>
            <p className="mt-1 text-sm text-[#1B1B1B]/50">Tour Requests</p>
          </div>
        </div>

        <div className="mb-6 flex w-fit gap-1 rounded-lg bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-sm transition-colors ${
                tab === t ? "bg-[#1B1B1B] text-white" : "text-[#1B1B1B]/60 hover:text-[#1B1B1B]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Saved Properties" &&
          (savedProperties.length === 0 ? (
            <EmptyState message="You haven't saved any properties yet." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {savedProperties.map((p) => (
                <PropertyCard
                  key={p.mlsNumber}
                  property={p}
                  isSaved={savedSet.has(p.mlsNumber)}
                  onToggleSave={toggle}
                />
              ))}
            </div>
          ))}

        {tab === "Tour Requests" &&
          (tourRequests.length === 0 ? (
            <EmptyState message="No tour requests yet." />
          ) : (
            <div className="flex flex-col gap-3">
              {tourRequests.map((r) => (
                <div key={r.id} className="rounded-xl bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm text-[#1B1B1B]">{r.notes ?? "—"}</p>
                    <span className="shrink-0 rounded-full bg-[#F2F0EF] px-2.5 py-0.5 text-xs text-[#1B1B1B]/60">
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#1B1B1B]/40">
                    {new Date(r.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
