"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

type Category = "campaign" | "action_plan" | "property_alert";
type Preferences = Partial<Record<Category, boolean>>;

const LABELS: Record<Category, { title: string; blurb: string }> = {
  campaign: {
    title: "Market updates & announcements",
    blurb: "Occasional news, market reports and updates from CnC Realty.",
  },
  action_plan: {
    title: "Follow-up from your agent",
    blurb: "Messages your agent sends as part of staying in touch.",
  },
  property_alert: {
    title: "New listing alerts",
    blurb: "Homes matching the searches you saved.",
  },
};

function PreferencesForm() {
  const token = useSearchParams().get("t") ?? "";
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [arrivedFrom, setArrivedFrom] = useState<Category | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "saving" | "done" | "error">("loading");

  // Reading preferences is a GET and never mutates. The opt-out itself only
  // ever happens on an explicit POST, because mail scanners prefetch links
  // found in email and would otherwise unsubscribe people who never clicked.
  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    fetch(`/api/unsubscribe/preferences?t=${encodeURIComponent(token)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad token"))))
      .then((data) => {
        setPrefs(data.preferences);
        setArrivedFrom(data.category);
        setState("idle");
      })
      .catch(() => setState("error"));
  }, [token]);

  const save = useCallback(
    async (next: Preferences) => {
      setState("saving");
      try {
        const res = await fetch("/api/unsubscribe/preferences", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, preferences: next }),
        });
        if (!res.ok) throw new Error("save failed");
        setPrefs(next);
        setState("done");
      } catch {
        setState("error");
      }
    },
    [token]
  );

  if (state === "loading") {
    return <p className="text-[#1B1B1B]/70">Loading your preferences…</p>;
  }

  if (state === "error" && !prefs) {
    return (
      <>
        <h1 className="font-sans text-[2rem] font-light text-[#1B1B1B]">Unsubscribe</h1>
        <p className="mt-4 text-sm text-red-600">
          That link is invalid or expired. Please use the link from a recent email.
        </p>
      </>
    );
  }

  if (state === "done") {
    return (
      <>
        <h1 className="font-sans text-[2rem] font-light text-[#1B1B1B]">
          Preferences saved
        </h1>
        <p className="mt-4 text-[#1B1B1B]/70">
          You&apos;ll still receive messages about your account and any active
          transactions — those aren&apos;t marketing emails.
        </p>
      </>
    );
  }

  const categories = Object.keys(prefs ?? {}) as Category[];

  return (
    <>
      <h1 className="font-sans text-[2rem] font-light text-[#1B1B1B]">Email preferences</h1>
      <p className="mt-4 text-[#1B1B1B]/70">
        Choose what you&apos;d like to keep receiving from CnC Realty.
      </p>

      <div className="mt-8 space-y-4 text-left">
        {categories.map((category) => (
          <label
            key={category}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#1B1B1B]/10 p-4"
          >
            <input
              type="checkbox"
              checked={prefs?.[category] ?? false}
              onChange={(e) =>
                setPrefs({ ...(prefs ?? {}), [category]: e.target.checked })
              }
              className="mt-1 h-5 w-5 shrink-0 accent-[#9E8C61]"
            />
            <span>
              <span className="block text-[#1B1B1B]">
                {LABELS[category].title}
                {category === arrivedFrom && (
                  <span className="ml-2 text-xs text-[#9E8C61]">this email</span>
                )}
              </span>
              <span className="block text-sm text-[#1B1B1B]/60">
                {LABELS[category].blurb}
              </span>
            </span>
          </label>
        ))}
      </div>

      {state === "error" && (
        <p className="mt-4 text-sm text-red-600">
          Something went wrong saving that. Please try again.
        </p>
      )}

      <motion.button
        type="button"
        onClick={() => save(prefs ?? {})}
        disabled={state === "saving"}
        animate={PULSE_ANIMATE}
        transition={PULSE_TRANSITION}
        whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
        className="mt-8 rounded-full bg-[#1B1B1B] px-7 py-3.5 text-white disabled:opacity-50"
      >
        {state === "saving" ? "Saving…" : "Save preferences"}
      </motion.button>

      <button
        type="button"
        onClick={() =>
          save(Object.fromEntries(categories.map((c) => [c, false])) as Preferences)
        }
        disabled={state === "saving"}
        className="mt-4 block w-full text-sm text-[#1B1B1B]/60 underline disabled:opacity-50"
      >
        Unsubscribe from all marketing email
      </button>
    </>
  );
}

export default function UnsubscribePage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-cnc-bg px-6 py-16">
      <div className="w-full max-w-md text-center">
        {/* useSearchParams needs a Suspense boundary or the route opts into
            dynamic rendering at build time. */}
        <Suspense fallback={null}>
          <PreferencesForm />
        </Suspense>
      </div>
    </main>
  );
}
