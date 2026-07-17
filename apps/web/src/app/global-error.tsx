"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-white/70">
            We&apos;ve been notified and are looking into it.
          </p>
          <button
            onClick={() => reset()}
            className="rounded-full bg-white px-6 py-2 font-medium text-black"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
