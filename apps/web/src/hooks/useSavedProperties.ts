"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface UseSavedPropertiesResult {
  savedSet: Set<string>;
  toggle: (mlsNumber: string) => void;
}

export function useSavedProperties(): UseSavedPropertiesResult {
  const { data: session } = useSession();
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session) {
      setSavedSet(new Set());
      return;
    }

    const controller = new AbortController();

    fetch("/api/saved-properties", { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { mlsNumbers: string[] }) => {
        setSavedSet(new Set(data.mlsNumbers));
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") {
          console.error("[useSavedProperties] Failed to load saved properties:", err);
        }
      });

    return () => controller.abort();
  }, [session]);

  const toggle = useCallback(async (mlsNumber: string) => {
    // Read current state inside the updater so this callback stays stable (no savedSet dep)
    let isSaved = false;
    setSavedSet((prev) => {
      isSaved = prev.has(mlsNumber);
      const next = new Set(prev);
      if (isSaved) next.delete(mlsNumber);
      else next.add(mlsNumber);
      return next;
    });

    try {
      if (isSaved) {
        await fetch(`/api/saved-properties/${mlsNumber}`, { method: "DELETE" });
      } else {
        await fetch("/api/saved-properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mlsNumber }),
        });
      }
    } catch {
      setSavedSet((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(mlsNumber);
        else next.delete(mlsNumber);
        return next;
      });
    }
  }, []);

  return { savedSet, toggle };
}
