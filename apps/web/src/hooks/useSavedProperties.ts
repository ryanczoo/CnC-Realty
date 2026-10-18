"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { savedPropertiesKey, fetchSavedMlsNumbers, withToggled } from "@/lib/saved-properties";

interface UseSavedPropertiesResult {
  savedSet: Set<string>;
  toggle: (mlsNumber: string) => void;
}

const EMPTY = new Set<string>();

// Every heart on the page shares one cached list (see lib/saved-properties), so a save
// from any heart — card, popup, desktop or phone button — shows on all of them at once.
export function useSavedProperties(): UseSavedPropertiesResult {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const key = savedPropertiesKey(userId ?? "signed-out");
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: key,
    queryFn: fetchSavedMlsNumbers,
    enabled: !!userId,
    staleTime: 60_000,
  });

  const toggle = useCallback(
    async (mlsNumber: string) => {
      const isSaved = queryClient.getQueryData<Set<string>>(key)?.has(mlsNumber) ?? false;
      queryClient.setQueryData<Set<string>>(key, (prev) => withToggled(prev, mlsNumber));

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
        queryClient.setQueryData<Set<string>>(key, (prev) => withToggled(prev, mlsNumber));
      }
    },
    // key is rebuilt each render; userId is what it depends on
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, userId],
  );

  return { savedSet: data ?? EMPTY, toggle };
}
