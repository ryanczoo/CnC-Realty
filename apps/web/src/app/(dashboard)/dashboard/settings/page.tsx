"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function AgentSettingsPage() {
  const { data: session, update } = useSession();

  // --- Left column: profile state ---
  const [nameInput, setNameInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [languageInput, setLanguageInput] = useState("");
  const [licenseInput, setLicenseInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(true);

  // --- Right column: agent profile state ---
  const [agentProfile, setAgentProfile] = useState({
    bio: "",
    yearsExp: "",
    listingsClosed: "",
    volumeClosed: "",
    propertiesRented: "",
    instagram: "",
    facebook: "",
    headshot: null as string | null,
  });
  const [agentSlug, setAgentSlug] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState(true);
  const [headshotUploading, setHeadshotUploading] = useState(false);
  const [headshotKey, setHeadshotKey] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load display name from session
  useEffect(() => {
    if (session?.user?.name) setNameInput(session.user.name);
  }, [session?.user?.name]);

  // Load license number
  useEffect(() => {
    fetch("/api/account/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.licenseNum) setLicenseInput(d.licenseNum);
        if (d?.location) setLocationInput(d.location);
        if (d?.language) setLanguageInput(d.language);
      })
      .catch(() => {});
  }, []);

  // Load agent profile on mount
  useEffect(() => {
    fetch("/api/account/agent-profile")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setAgentProfile({
          bio: d.bio ?? "",
          yearsExp: d.yearsExp?.toString() ?? "",
          listingsClosed: d.listingsClosed > 0 ? d.listingsClosed.toString() : "",
          volumeClosed: d.volumeClosed > 0 ? Math.round(d.volumeClosed).toLocaleString("en-US") : "",
          propertiesRented: d.propertiesRented != null && d.propertiesRented > 0 ? d.propertiesRented.toString() : "",
          instagram: d.instagram ?? "",
          facebook: d.facebook ?? "",
          headshot: d.headshot ?? null,
        });
        if (d.headshot) setHeadshotKey(Date.now().toString());
        if (d.slug) setAgentSlug(d.slug);
      })
      .catch(() => {});
  }, []);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput, licenseNum: licenseInput, location: locationInput, language: languageInput }),
      });
      if (!res.ok) throw new Error("Failed");
      await update({ name: nameInput });
      setSaveOk(true);
      setSaveMsg("Profile updated.");
    } catch {
      setSaveOk(false);
      setSaveMsg("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleHeadshotChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setProfileOk(false);
      setProfileMsg("Only JPEG, PNG, or WebP images allowed.");
      return;
    }
    setHeadshotUploading(true);
    setProfileMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/account/headshot-upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Upload failed (${res.status})`);
      }
      await res.json();
      setHeadshotKey(Date.now().toString());
      setProfileOk(true);
      setProfileMsg("Photo updated.");
      e.target.value = "";
    } catch (err) {
      console.error("[headshot upload]", err);
      setProfileOk(false);
      setProfileMsg(err instanceof Error ? err.message : "Photo upload failed. Try again.");
    } finally {
      setHeadshotUploading(false);
    }
  }

  async function handleSaveAgentProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/account/agent-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: agentProfile.bio,
          yearsExp: agentProfile.yearsExp !== "" ? Number(agentProfile.yearsExp) : null,
          listingsClosed: agentProfile.listingsClosed !== "" ? Number(agentProfile.listingsClosed) : 0,
          volumeClosed: agentProfile.volumeClosed !== "" ? Number(agentProfile.volumeClosed.replace(/,/g, "")) : 0,
          propertiesRented: agentProfile.propertiesRented !== "" ? Number(agentProfile.propertiesRented) : 0,
          instagram: agentProfile.instagram,
          facebook: agentProfile.facebook,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setProfileOk(true);
      setProfileMsg("Agent profile updated.");
    } catch {
      setProfileOk(false);
      setProfileMsg("Something went wrong. Try again.");
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-8 font-sans text-2xl font-light text-[#1B1B1B]">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-5xl">
        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-5">
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
              <div>
                <label className="mb-1.5 block text-xs text-[#1B1B1B]/50" htmlFor="location">
                  Location Served
                </label>
                <input
                  id="location"
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder=""
                  className="w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2.5 text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#1B1B1B]/50" htmlFor="language">
                  Languages Spoken
                </label>
                <input
                  id="language"
                  type="text"
                  value={languageInput}
                  onChange={(e) => setLanguageInput(e.target.value)}
                  placeholder=""
                  className="w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2.5 text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#1B1B1B]/50" htmlFor="license">
                  DRE License #
                </label>
                <input
                  id="license"
                  type="text"
                  value={licenseInput}
                  onChange={(e) => setLicenseInput(e.target.value)}
                  placeholder="e.g. 01234567"
                  className="w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2.5 text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] transition-colors"
                />
              </div>
              {saveMsg && (
                <p className={`text-xs ${saveOk ? "text-green-600" : "text-red-500"}`}>
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

        {/* ── RIGHT COLUMN — Agent Profile ── */}
        <div className="flex flex-col gap-5">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-[#1B1B1B]">Agent Profile</h2>
            <form onSubmit={handleSaveAgentProfile} className="flex flex-col gap-4">

              {/* Headshot */}
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[#F2F0EF]">
                  {headshotKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/headshot/${(session as any)?.user?.id}?t=${headshotKey}`}
                      alt="Headshot"
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="font-sans text-2xl font-light text-[#1B1B1B]/20">
                        {(session?.user?.name ?? "A")[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={headshotUploading}
                    className="rounded-full border border-[#1B1B1B]/20 px-4 py-2 text-xs text-[#1B1B1B] transition-colors hover:border-[#1B1B1B] disabled:opacity-40"
                  >
                    {headshotUploading ? "Uploading…" : "Change Photo"}
                  </button>
                  <p className="text-[11px] text-[#1B1B1B]/40">JPEG, PNG, or WebP. Max 5MB.</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleHeadshotChange}
                />
              </div>

              {/* Bio */}
              <div>
                <label className="mb-1.5 block text-xs text-[#1B1B1B]/50" htmlFor="bio">
                  Bio
                </label>
                <textarea
                  id="bio"
                  rows={3}
                  value={agentProfile.bio}
                  onChange={(e) => setAgentProfile((prev) => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell clients about yourself…"
                  className="w-full resize-none rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2.5 text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] transition-colors"
                />
              </div>

              {/* Years of Experience */}
              <div>
                <label className="mb-1.5 block text-xs text-[#1B1B1B]/50" htmlFor="yearsExp">
                  Years of Experience
                </label>
                <input
                  id="yearsExp"
                  type="number"
                  min={0}
                  step={1}
                  value={agentProfile.yearsExp}
                  onChange={(e) => setAgentProfile((prev) => ({ ...prev, yearsExp: e.target.value.replace(/\D/g, "") }))}
                  className="w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2.5 text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] transition-colors"
                />
              </div>

              {/* Listings Closed */}
              <div>
                <label className="mb-1.5 block text-xs text-[#1B1B1B]/50" htmlFor="listingsClosed">
                  Listings Closed
                </label>
                <input
                  id="listingsClosed"
                  type="number"
                  min={0}
                  step={1}
                  value={agentProfile.listingsClosed}
                  onChange={(e) => setAgentProfile((prev) => ({ ...prev, listingsClosed: e.target.value.replace(/\D/g, "") }))}
                  className="w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2.5 text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] transition-colors"
                />
              </div>

              {/* Volume Closed */}
              <div>
                <label className="mb-1.5 block text-xs text-[#1B1B1B]/50" htmlFor="volumeClosed">
                  Volume Closed ($)
                </label>
                <input
                  id="volumeClosed"
                  type="text"
                  inputMode="numeric"
                  value={agentProfile.volumeClosed}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                    setAgentProfile((prev) => ({ ...prev, volumeClosed: formatted }));
                  }}
                  className="w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2.5 text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] transition-colors"
                />
              </div>

              {/* Properties Rented */}
              <div>
                <label className="mb-1.5 block text-xs text-[#1B1B1B]/50" htmlFor="propertiesRented">
                  Properties Rented
                </label>
                <input
                  id="propertiesRented"
                  type="number"
                  min={0}
                  step={1}
                  value={agentProfile.propertiesRented}
                  onChange={(e) => setAgentProfile((prev) => ({ ...prev, propertiesRented: e.target.value.replace(/\D/g, "") }))}
                  className="w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2.5 text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] transition-colors"
                />
              </div>

              {/* Social Links */}
              <div>
                <label className="mb-1.5 block text-xs text-[#1B1B1B]/50" htmlFor="instagram">
                  Instagram URL
                </label>
                <input
                  id="instagram"
                  type="text"
                  value={agentProfile.instagram}
                  onChange={(e) => setAgentProfile((prev) => ({ ...prev, instagram: e.target.value }))}
                  placeholder="https://instagram.com/yourhandle"
                  className="w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2.5 text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#1B1B1B]/50" htmlFor="facebook">
                  Facebook URL
                </label>
                <input
                  id="facebook"
                  type="text"
                  value={agentProfile.facebook}
                  onChange={(e) => setAgentProfile((prev) => ({ ...prev, facebook: e.target.value }))}
                  placeholder="https://facebook.com/yourpage"
                  className="w-full rounded-lg border border-[#1B1B1B]/10 bg-white px-3 py-2.5 text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] transition-colors"
                />
              </div>
              {/* Status message */}
              {profileMsg && (
                <p className={`text-xs ${profileOk ? "text-green-600" : "text-red-500"}`}>
                  {profileMsg}
                </p>
              )}

              {/* Save button */}
              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="self-start rounded-full bg-[#1B1B1B] px-6 py-2.5 text-sm text-white transition-opacity hover:opacity-75 disabled:opacity-40"
                >
                  {profileSaving ? "Saving…" : "Save Agent Profile"}
                </button>
                {agentSlug && (
                  <Link
                    href={`/agents/${agentSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-start rounded-full border border-[#1B1B1B]/20 px-6 py-2.5 font-sans text-sm text-[#1B1B1B] transition-colors hover:border-[#1B1B1B]"
                  >
                    View Public Profile
                  </Link>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
