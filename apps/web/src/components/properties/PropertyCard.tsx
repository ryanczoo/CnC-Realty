"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Heart } from "lucide-react";
import { PropertyListing } from "@/types/property";

interface Props {
  property: PropertyListing;
  isSaved: boolean;
  onToggleSave: (mlsNumber: string) => void;
  onHover?: (mlsNumber: string | null) => void;
}

export function PropertyCard({ property, isSaved, onToggleSave, onHover }: Props) {
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

  return (
    <>
      <Link
        href={`/properties/${property.mlsNumber}`}
        onMouseEnter={() => onHover?.(property.mlsNumber)}
        onMouseLeave={() => onHover?.(null)}
        className="group relative flex gap-3 rounded-xl bg-[#1a1a1a] p-3 transition-colors hover:bg-[#222]"
      >
        <div className="relative h-[88px] w-[116px] flex-shrink-0 overflow-hidden rounded-lg bg-[#2a2a2a]">
          {thumb ? (
            <Image
              src={thumb}
              alt={property.address}
              fill
              className="object-cover"
              sizes="116px"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-[#555]">
              No photo
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">
            {property.status}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[15px] font-semibold text-white">
            ${property.listPrice.toLocaleString()}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            {property.beds != null && <span>{property.beds} bd</span>}
            {property.baths != null && (
              <>
                <span className="text-white/20">·</span>
                <span>{property.baths} ba</span>
              </>
            )}
            {property.sqft != null && (
              <>
                <span className="text-white/20">·</span>
                <span>{property.sqft.toLocaleString()} sf</span>
              </>
            )}
          </div>
          <p className="truncate text-sm text-white/70">{property.address}</p>
          <p className="text-xs text-white/40">
            {property.city}, {property.state}
          </p>
          {property.propertyType && (
            <span className="mt-auto w-fit rounded-full bg-[#9E8C61]/20 px-2 py-0.5 text-[10px] text-[#9E8C61]">
              {property.propertyType}
            </span>
          )}
        </div>

        <button
          onClick={handleHeartClick}
          className="absolute right-3 top-3 rounded-full bg-black/40 p-1.5 backdrop-blur-sm transition-colors hover:bg-black/60"
          aria-label={isSaved ? "Remove from saved" : "Save property"}
        >
          <Heart
            className={`h-4 w-4 transition-colors ${
              isSaved ? "fill-[#9E8C61] text-[#9E8C61]" : "text-white/60"
            }`}
          />
        </button>
      </Link>

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
