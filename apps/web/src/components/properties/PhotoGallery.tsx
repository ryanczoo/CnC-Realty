"use client";

import Image from "next/image";
import { useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  photos: string[];
  address: string;
}

export function PhotoGallery({ photos, address }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl bg-[#1a1a1a] text-sm text-white/30">
        No photos available
      </div>
    );
  }

  const mainPhoto = photos[0];
  const thumbs = photos.slice(1, 5);

  return (
    <>
      <div className="relative grid h-[420px] grid-cols-4 grid-rows-2 gap-1 overflow-hidden rounded-2xl">
        {/* Main large photo — spans 2 cols × 2 rows */}
        <button
          className="relative col-span-2 row-span-2 overflow-hidden"
          onClick={() => setLightboxIndex(0)}
          aria-label="View main photo"
        >
          <Image
            src={mainPhoto}
            alt={address}
            fill
            className="object-cover transition-transform duration-300 hover:scale-105"
            sizes="50vw"
            priority
            unoptimized
          />
        </button>

        {/* Thumbnails */}
        {thumbs.map((photo, i) => (
          <button
            key={i}
            className="relative overflow-hidden"
            onClick={() => setLightboxIndex(i + 1)}
            aria-label={`View photo ${i + 2}`}
          >
            <Image
              src={photo}
              alt={`${address} photo ${i + 2}`}
              fill
              className="object-cover transition-transform duration-300 hover:scale-105"
              sizes="25vw"
              unoptimized
            />
          </button>
        ))}

        {/* "See all photos" button */}
        <button
          onClick={() => setLightboxIndex(0)}
          className="absolute bottom-4 right-4 rounded-full bg-black/70 px-4 py-2 text-sm text-white backdrop-blur-sm hover:bg-black/90"
        >
          See all {photos.length} photos
        </button>
      </div>

      {/* Lightbox — rendered via portal so position:fixed escapes any transformed ancestor (drawer) */}
      {lightboxIndex !== null && createPortal(
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/95"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <span className="absolute top-4 left-1/2 -translate-x-1/2 text-sm text-white/60">
            {lightboxIndex + 1} / {photos.length}
          </span>

          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((i) => Math.max(0, (i ?? 1) - 1));
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
              src={photos[lightboxIndex]}
              alt={`${address} photo ${lightboxIndex + 1}`}
              fill
              className="object-contain"
              sizes="80vw"
              unoptimized
            />
          </div>

          {lightboxIndex < photos.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((i) => Math.min(photos.length - 1, (i ?? 0) + 1));
              }}
              aria-label="Next photo"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
