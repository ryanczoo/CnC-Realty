"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STORAGE_KEY = "cnc_cookie_consent";

export default function DoNotSellPage() {
  const [status, setStatus] = useState<"idle" | "opted-out" | "already-out">("idle");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "denied") setStatus("already-out");
  }, []);

  function handleOptOut() {
    localStorage.setItem(STORAGE_KEY, "denied");
    setStatus("opted-out");
    // Also try to opt out posthog if it was loaded
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const posthog = require("posthog-js").default;
      if (posthog.__loaded) posthog.opt_out_capturing();
    } catch {
      // posthog not loaded — nothing to do
    }
  }

  return (
    <div className="min-h-screen bg-[#F2F0EF]">
      <div className="bg-[#1B1B1B] px-8 pt-28 pb-16 lg:px-16">
        <p className="mb-3 font-sans text-xs uppercase tracking-widest text-white/40">Legal</p>
        <h1 className="font-sans text-3xl font-light text-white lg:text-4xl">
          Do Not Sell or Share My Personal Information
        </h1>
        <p className="mt-4 font-sans text-sm text-white/50">California Consumer Privacy Act (CCPA/CPRA) Opt-Out</p>
      </div>

      <div className="mx-auto max-w-4xl px-8 py-16 lg:px-16">
        <div className="space-y-10 font-sans text-[#1B1B1B]">

          <section>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              Under the California Consumer Privacy Act of 2018 as amended by the California Privacy Rights Act of 2020 (CCPA/CPRA), California residents have the right to direct CnC Realty Group to stop selling or sharing their personal information with third parties. This page allows you to exercise that right.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">What Information We Share</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">
              CnC Realty Group does not sell your personal information to third parties for monetary compensation. However, we may share certain usage data (such as pages viewed, search activity, and general location derived from IP address) with analytics providers such as PostHog. This sharing may qualify as a "sale" or "sharing" under the broad definitions in the CCPA/CPRA.
            </p>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              We do not share your contact information, property inquiry history, or financial information with any third party for their own marketing purposes without your explicit consent.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Exercise Your Right to Opt Out</h2>

            {status === "already-out" && (
              <div className="mb-6 rounded-xl border border-[#9E8C61]/30 bg-[#9E8C61]/10 px-6 py-4">
                <p className="font-sans text-base font-medium text-[#1B1B1B]">
                  You have already opted out of analytics data sharing on this device.
                </p>
                <p className="mt-1 font-sans text-sm text-[#1B1B1B]/70">
                  If you use multiple browsers or devices, you will need to opt out separately on each one.
                </p>
              </div>
            )}

            {status === "opted-out" && (
              <div className="mb-6 rounded-xl border border-[#9E8C61]/30 bg-[#9E8C61]/10 px-6 py-4">
                <p className="font-sans text-base font-medium text-[#1B1B1B]">
                  Your opt-out has been saved. We will no longer share your analytics data on this device.
                </p>
                <p className="mt-1 font-sans text-sm text-[#1B1B1B]/70">
                  If you use multiple browsers or devices, you will need to opt out separately on each one.
                </p>
              </div>
            )}

            {status === "idle" && (
              <div className="space-y-4">
                <p className="text-base leading-relaxed text-[#1B1B1B]/80">
                  Clicking the button below will stop the sharing of your analytics data on this browser and device. Your preference will be saved in your browser's local storage.
                </p>
                <button
                  onClick={handleOptOut}
                  className="rounded-full bg-[#1B1B1B] px-8 py-3 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80"
                >
                  Opt Out of Sale / Sharing
                </button>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Additional Ways to Opt Out</h2>
            <ul className="space-y-3 text-base leading-relaxed text-[#1B1B1B]/80">
              <li>
                <strong>Cookie Banner:</strong> When you first visit our Site, a cookie consent banner appears at the bottom of the page. Clicking <em>"Decline"</em> on that banner opts you out of analytics tracking immediately.
              </li>
              <li>
                <strong>Email Request:</strong> You may also submit an opt-out request by emailing us at{" "}
                <a href="mailto:info@cncrealtygroup.com" className="text-[#9E8C61] underline underline-offset-2">
                  info@cncrealtygroup.com
                </a>{" "}
                with the subject line "CCPA Opt-Out Request." Please include your name and the email address associated with your account (if any). We will respond within 45 days.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">No Discrimination</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              CnC Realty Group will not discriminate against you for exercising your CCPA/CPRA rights. Opting out will not affect your ability to use our Site, search listings, or request our real estate services.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Other Privacy Rights</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              California residents have additional privacy rights under the CCPA/CPRA, including the right to know what personal information we collect, the right to delete your personal information, and the right to correct inaccurate information. For a full description of your rights and our data practices, please review our{" "}
              <Link href="/privacy" className="text-[#9E8C61] underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Contact Us</h2>
            <address className="not-italic text-base leading-loose text-[#1B1B1B]/80">
              <strong>CnC Realty Group</strong><br />
              Los Angeles, CA<br />
              Email:{" "}
              <a href="mailto:info@cncrealtygroup.com" className="text-[#9E8C61] underline underline-offset-2">
                info@cncrealtygroup.com
              </a><br />
              CA DRE #02439028
            </address>
          </section>

        </div>
      </div>
    </div>
  );
}
