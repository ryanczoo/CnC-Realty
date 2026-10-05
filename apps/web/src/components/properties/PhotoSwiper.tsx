"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function swiperIndex(scrollLeft: number, width: number, count: number): number {
  if (width <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / width)));
}

interface Props {
  photos: string[];
  alt: string;
  className?: string;
  onPhotoClick?: (i: number) => void;
}

// Phone photo strip: swipe between full-width photos (same swipe-row classes as
// StatCards/SellProcess). Every image is lazy, so when this sits inside an
// lg:hidden wrapper desktop downloads nothing.
export function PhotoSwiper({ photos, alt, className = "", onPhotoClick }: Props) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  function onScroll() {
    const el = stripRef.current;
    if (el) setIdx(swiperIndex(el.scrollLeft, el.clientWidth, photos.length));
  }
  function go(delta: number) {
    const el = stripRef.current;
    if (!el) return;
    const next = (idx + delta + photos.length) % photos.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        ref={stripRef}
        onScroll={onScroll}
        className="flex h-full overflow-x-auto [scroll-snap-type:x_mandatory]"
        style={{ scrollbarWidth: "none" }}
      >
        {photos.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            onClick={() => onPhotoClick?.(i)}
            className="relative h-full w-full flex-shrink-0 [scroll-snap-align:start]"
            aria-label={`Photo ${i + 1} of ${photos.length}`}
          >
            <Image
              src={src}
              alt={i === 0 ? alt : `${alt} photo ${i + 1}`}
              fill
              sizes="100vw"
              loading="lazy"
              unoptimized
              className="object-cover"
            />
          </button>
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-sm">
            {idx + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
}
