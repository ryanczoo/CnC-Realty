"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Heart } from "lucide-react";
import { PropertyListing, formatPropertyStatus } from "@/types/property";

interface Props {
  property: PropertyListing;
  isSaved: boolean;
  onToggleSave: (mlsNumber: string) => void;
  onHover?: (mlsNumber: string | null) => void;
  onSelect?: (mlsNumber: string) => void;
}

export function PropertyCard({ property, isSaved, onToggleSave, onHover, onSelect }: Props) {
  const { data: session } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const thumb = property.photos[0] ?? null;

  function handleHeartClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!session) {
      setShowLoginModal(true);
      return;
    }
    onToggleSave(property.mlsNumber);
  }

  const sharedProps = {
    onMouseEnter: () => onHover?.(property.mlsNumber),
    onMouseLeave: () => onHover?.(null),
    className:
      "group flex flex-col overflow-hidden rounded-xl bg-[#1a1a1a] transition-colors hover:bg-[#222] cursor-pointer",
  };

  const inner = (
    <>
      {/* Photo */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#2a2a2a]">
        {thumb ? (
          <Image
            src={thumb}
            alt={property.address}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 280px"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[#555]">
            No photo
          </div>
        )}

        {/* Status badge */}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          {formatPropertyStatus(property.status)}
        </span>

        {/* Heart button */}
        <button
          onClick={handleHeartClick}
          className="absolute right-2.5 top-2.5 rounded-full bg-black/50 p-2 backdrop-blur-sm transition-colors hover:bg-black/70"
          aria-label={isSaved ? "Remove from saved" : "Save property"}
        >
          <Heart
            className={`h-4 w-4 transition-colors ${
              isSaved ? "fill-[#9E8C61] text-[#9E8C61]" : "text-white"
            }`}
          />
        </button>
      </div>

      {/* Details */}
      <div className="flex flex-col gap-1 p-3">
        <p className="text-base font-bold text-white">
          ${property.listPrice.toLocaleString()}
        </p>
        <div className="flex items-center gap-1 text-xs text-white/60">
          {property.beds != null && (
            <span>
              <strong className="text-white/80">{property.beds}</strong> bd
            </span>
          )}
          {property.baths != null && (
            <>
              <span className="text-white/20">|</span>
              <span>
                <strong className="text-white/80">{property.baths}</strong> ba
              </span>
            </>
          )}
          {property.sqft != null && (
            <>
              <span className="text-white/20">|</span>
              <span>
                <strong className="text-white/80">{property.sqft.toLocaleString()}</strong> sqft
              </span>
            </>
          )}
        </div>
        <p className="truncate text-xs text-white/60">
          {property.address}, {property.city}, {property.state}
        </p>
        {property.propertyType && (
          <span className="mt-1 w-fit rounded-full bg-[#9E8C61]/15 px-2 py-0.5 text-[10px] text-[#9E8C61]">
            {property.propertyType}
          </span>
        )}
      </div>
    </>
  );

  return (
    <>
      {onSelect ? (
        <div {...sharedProps} onClick={() => onSelect(property.mlsNumber)}>
          {inner}
        </div>
      ) : (
        <Link href={`/properties/${property.mlsNumber}`} {...sharedProps}>
          {inner}
        </Link>
      )}

      {showLoginModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="w-80 rounded-2xl bg-[#1a1a1a] p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Heart className="mx-auto mb-3 h-8 w-8 text-[#9E8C61]" />
            <h3 className="mb-2 text-lg font-semibold text-white">Sign in to save</h3>
            <p className="mb-5 text-sm text-white/60">
              Create a free account to save properties and set up alerts.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLoginModal(false)}
                className="flex-1 rounded-full border border-white/20 py-2 text-sm text-white/70 hover:border-white/40"
              >
                Cancel
              </button>
              <Link
                href="/login?callbackUrl=/properties"
                className="flex-1 rounded-full bg-[#9E8C61] py-2 text-sm font-medium text-white"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
