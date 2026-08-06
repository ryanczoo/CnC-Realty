"use client";

import { useState } from "react";
import Image from "next/image";

export function VideoCard({
  title,
  youtubeId,
  description,
  creditLabel,
}: {
  title: string;
  youtubeId: string;
  description?: string | null;
  creditLabel?: string | null;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-[#1B1B1B]/10 bg-white">
      <div className="relative aspect-video w-full bg-[#1B1B1B]">
        {playing ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
            title={title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative block h-full w-full"
            aria-label={`Play ${title}`}
          >
            <Image
              src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
              alt={title}
              fill
              className="object-cover"
              unoptimized
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/35">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 transition-transform group-hover:scale-110">
                <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
                  <path d="M1 1.5L18.5 12L1 22.5V1.5Z" fill="#1B1B1B" />
                </svg>
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="p-4">
        <p className="font-sans text-sm font-medium text-[#1B1B1B]">{title}</p>
        {description && (
          <p className="mt-1 font-sans text-xs text-[#1B1B1B]/50">{description}</p>
        )}
        {creditLabel && (
          <p className="mt-2 font-sans text-xs text-[#1B1B1B]/40">
            {creditLabel} ·{" "}
            <a
              href={`https://www.youtube.com/watch?v=${youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#9E8C61]"
            >
              Watch original ↗
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
