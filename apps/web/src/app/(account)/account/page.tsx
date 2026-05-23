"use client";

import { useSession, signOut } from "next-auth/react";
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

const TABS = ["Saved Properties", "Tour Requests", "Settings"] as const;
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
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { savedSet, toggle } = useSavedProperties();
  const [tab, setTab] = useState<Tab>("Saved Properties");
  const [savedProperties, setSavedProperties] = useState<PropertyListing[]>([]);
  const [tourRequests, setTourRequests] = useState<TourRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

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
    }).catch((err) => {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Account data fetch failed:", err);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [status, userId, role, router]);

  useEffect(() => {
    if (session?.user?.name) setNameInput(session.user.name);
  }, [session?.user?.name]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await update({ name: nameInput });
      setSaveMsg("Name updated.");
    } catch {
      setSaveMsg("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

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
            <span className="font-medium text-[#9E8C61]">{session?.user.name ?? "there"}</span>
          </h1>
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

        {tab === "Settings" && (
          <div className="flex flex-col gap-5 max-w-lg">
            {/* Profile */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-[#1B1B1B]">Profile</h2>
              <form onSubmit={handleSaveName} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-xs text-[#1B1B1B]/50">Email</label>
                  <p className="rounded-lg bg-[#F2F0EF] px-3 py-2.5 text-sm text-[#1B1B1B]/70">
                    {session?.user?.email}
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#1B1B1B]/50" htmlFor="name">
                    Display Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2.5 text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] transition-colors"
                  />
                </div>
                {saveMsg && (
                  <p className={`text-xs ${saveMsg.includes("updated") ? "text-green-600" : "text-red-500"}`}>
                    {saveMsg}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="self-start rounded-full bg-[#1B1B1B] px-6 py-2.5 text-sm text-white transition-opacity hover:opacity-75 disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </form>
            </div>

            {/* Password */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-1 text-sm font-semibold text-[#1B1B1B]">Password</h2>
              <p className="mb-4 text-xs text-[#1B1B1B]/40">
                Use the forgot password flow to set a new password.
              </p>
              <Link
                href="/forgot-password"
                className="inline-block rounded-full border border-[#1B1B1B]/20 px-6 py-2.5 text-sm text-[#1B1B1B] transition-colors hover:border-[#1B1B1B]"
              >
                Reset Password
              </Link>
            </div>

            {/* Sign out */}
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-1 text-sm font-semibold text-[#1B1B1B]">Account</h2>
              <p className="mb-4 text-xs text-[#1B1B1B]/40">Sign out of your account on this device.</p>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-full border border-red-200 px-6 py-2.5 text-sm text-red-500 transition-colors hover:border-red-400"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
