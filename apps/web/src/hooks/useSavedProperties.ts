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

    fetch("/api/saved-properties")
      .then((r) => r.json())
      .then((data: { mlsNumbers: string[] }) => {
        setSavedSet(new Set(data.mlsNumbers));
      })
      .catch(() => {});
  }, [session]);

  const toggle = useCallback(
    async (mlsNumber: string) => {
      const isSaved = savedSet.has(mlsNumber);

      // Optimistic update
      setSavedSet((prev) => {
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
        // Roll back on error
        setSavedSet((prev) => {
          const next = new Set(prev);
          if (isSaved) next.add(mlsNumber);
          else next.delete(mlsNumber);
          return next;
        });
      }
    },
    [savedSet]
  );

  return { savedSet, toggle };
}
