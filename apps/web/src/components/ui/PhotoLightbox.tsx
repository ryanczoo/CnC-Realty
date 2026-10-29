"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  photos: string[];
  index: number;
  alt: (i: number) => string;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}

// Full-size photo view over the page — the listing gallery's lightbox, shared
// with the file pages' header photo. Close button in the corner; clicking or
// tapping outside the photo (or Escape) closes it. The "1 / N" counter and the
// arrows only appear with more than one photo. Rendered via portal so
// position:fixed escapes any transformed ancestor (drawer).
export function PhotoLightbox({ photos, index, alt, onIndexChange, onClose }: Props) {
  // One Escape listener while open; the ref keeps it calling the latest onClose
  // without re-subscribing on every render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const several = photos.length > 1;

  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 z-[500] flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      <button
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {several && (
        <span className="absolute top-4 left-1/2 -translate-x-1/2 text-sm text-white/60">
          {index + 1} / {photos.length}
        </span>
      )}

      {several && index > 0 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(Math.max(0, index - 1));
          }}
          aria-label="Previous photo"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      <div
        className="relative h-[80vh] w-[80vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={photos[index]}
          alt={alt(index)}
          fill
          className="object-contain"
          sizes="80vw"
          unoptimized
        />
      </div>

      {several && index < photos.length - 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(Math.min(photos.length - 1, index + 1));
          }}
          aria-label="Next photo"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>,
    document.body
  );
}
