"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function swiperIndex(scrollLeft: number, width: number, count: number): number {
  if (width <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / width)));
}

// One-photo steps animate; a wrap-around (last ↔ first) jumps, so the strip
// doesn't scroll past — and lazy-load — every photo in between.
export function scrollBehaviorFor(from: number, to: number): ScrollBehavior {
  return Math.abs(to - from) > 1 ? "instant" : "smooth";
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
    el.scrollTo({ left: next * el.clientWidth, behavior: scrollBehaviorFor(idx, next) });
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${alt} photos`}
    >
      <div
        ref={stripRef}
        onScroll={onScroll}
        className="flex h-full overflow-x-auto [scroll-snap-type:x_mandatory]"
        style={{ scrollbarWidth: "none" }}
      >
        {photos.map((src, i) => {
          const image = (
            <Image
              src={src}
              alt={i === 0 ? alt : `${alt} photo ${i + 1}`}
              fill
              sizes="100vw"
              loading="lazy"
              unoptimized
              className="object-cover"
            />
          );
          const slide = "relative h-full w-full flex-shrink-0 [scroll-snap-align:start]";
          // Only tappable when tapping does something (the full page's lightbox);
          // otherwise a plain slide, so keyboard users don't tab through 25 no-op buttons.
          return onPhotoClick ? (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => onPhotoClick(i)}
              className={slide}
              aria-label={`Open photo ${i + 1} of ${photos.length}`}
            >
              {image}
            </button>
          ) : (
            <div key={`${src}-${i}`} className={slide}>
              {image}
            </div>
          );
        })}
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
          <div
            aria-live="polite"
            className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-sm"
          >
            {idx + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
}
