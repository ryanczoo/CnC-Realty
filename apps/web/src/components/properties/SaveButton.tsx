"use client";

import { Heart } from "lucide-react";
import { useSavedProperties } from "@/hooks/useSavedProperties";

interface Props {
  mlsNumber: string;
}

export function SaveButton({ mlsNumber }: Props) {
  const { savedSet, toggle } = useSavedProperties();
  const saved = savedSet.has(mlsNumber);

  return (
    <button
      onClick={() => toggle(mlsNumber)}
      className="rounded-full p-2 transition-colors hover:bg-[#1B1B1B]/5"
      aria-label={saved ? "Remove from saved" : "Save property"}
    >
      <Heart
        className={`h-6 w-6 transition-colors ${
          saved ? "fill-[#9E8C61] text-[#9E8C61]" : "text-[#1B1B1B]/40 hover:text-[#1B1B1B]/70"
        }`}
      />
    </button>
  );
}
