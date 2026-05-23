"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AgentSettingsPage() {
  const { data: session, update } = useSession();
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

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
      if (!res.ok) throw new Error("Failed");
      await update({ name: nameInput });
      setSaveMsg("Name updated.");
    } catch {
      setSaveMsg("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-8 font-sans text-2xl font-light text-[#1B1B1B]">Settings</h1>

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

        {/* Agent Profile link */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-[#1B1B1B]">Public Agent Profile</h2>
          <p className="mb-4 text-xs text-[#1B1B1B]/40">
            Your bio, headshot, and stats visible to clients.
          </p>
          <Link
            href="/join"
            className="inline-block rounded-full border border-[#1B1B1B]/20 px-6 py-2.5 text-sm text-[#1B1B1B] transition-colors hover:border-[#1B1B1B]"
          >
            Edit Profile
          </Link>
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
    </div>
  );
}
