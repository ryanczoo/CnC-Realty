"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { X, BedDouble, Bath, Ruler, Calendar, MapPin, ChevronLeft, ChevronRight, ShieldCheck, Loader2 } from "lucide-react";
import { ContactForm } from "./ContactForm";
import { MortgageCalculator } from "./MortgageCalculator";

interface PropertyDetail {
  mlsNumber: string;
  status: string;
  listingType: string;
  listPrice: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  propertyType: string | null;
  description: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  photos: unknown;
  listedAt: string | null;
  syncedAt: string | null;
  rawData: Record<string, unknown> | null;
}

interface Props {
  mlsNumber: string;
  onClose: () => void;
}

export function PropertyDrawer({ mlsNumber, onClose }: Props) {
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoading(true);
    setIsError(false);
    setPhotoIdx(0);
    setProperty(null);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    fetch(`/api/properties/${mlsNumber}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => setProperty(data))
      .catch(() => setIsError(true))
      .finally(() => setIsLoading(false));
  }, [mlsNumber]);

  const photos = Array.isArray(property?.photos) ? (property!.photos as string[]) : [];

  const facts = property
    ? [
        property.beds != null && { icon: BedDouble, label: "Beds", value: property.beds },
        property.baths != null && { icon: Bath, label: "Baths", value: property.baths },
        property.sqft != null && { icon: Ruler, label: "Sq Ft", value: property.sqft.toLocaleString() },
        property.yearBuilt != null && { icon: Calendar, label: "Year Built", value: property.yearBuilt },
      ].filter(Boolean) as { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }[]
    : [];

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 bg-black/50"
        style={{ top: "64px" }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed bottom-0 right-0 z-50 flex flex-col overflow-hidden bg-[#0f0f0f] shadow-2xl"
        style={{ top: "64px", width: "min(880px, 63vw)" }}
      >
        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
            Back to search
          </button>
          {property && (
            <a
              href={`/properties/${property.mlsNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              Open full page ↗
            </a>
          )}
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#9E8C61]" />
            </div>
          )}

          {isError && (
            <div className="flex h-64 items-center justify-center text-sm text-red-400">
              Failed to load listing. Please try again.
            </div>
          )}

          {!isLoading && !isError && property && (
            <div className="pb-10">
              {/* Photo carousel */}
              <div className="relative h-72 w-full bg-[#1a1a1a] sm:h-80 md:h-96">
                {photos.length > 0 ? (
                  <>
                    <Image
                      src={photos[photoIdx]}
                      alt={property.address}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    {photos.length > 1 && (
                      <>
                        <button
                          onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-sm">
                          {photoIdx + 1} / {photos.length}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-white/30">No photos</div>
                )}
                {/* Status badge */}
                <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  {property.status}
                </span>
              </div>

              {/* Content: two columns at wider widths */}
              <div className="flex gap-6 px-6 pt-6">
                {/* Left: main details */}
                <div className="min-w-0 flex-1">
                  {/* Header */}
                  <h1 className="text-2xl font-bold text-white">
                    ${property.listPrice.toLocaleString()}
                  </h1>
                  <p className="mt-1 text-base text-white/70">{property.address}</p>
                  <p className="text-sm text-white/50">
                    {property.city}, {property.state} {property.zip}
                  </p>

                  {/* Key facts */}
                  {facts.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {facts.map(({ icon: Icon, label, value }) => (
                        <div
                          key={label}
                          className="flex items-center gap-2 rounded-lg bg-[#1a1a1a] px-3 py-2"
                        >
                          <Icon className="h-4 w-4 text-[#9E8C61]" />
                          <div>
                            <p className="text-[10px] text-white/40">{label}</p>
                            <p className="text-sm font-semibold text-white">{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Description */}
                  {property.description && (
                    <div className="mt-5">
                      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/50">
                        About this home
                      </h2>
                      <p className="text-sm leading-relaxed text-white/70">
                        {property.description}
                      </p>
                    </div>
                  )}

                  {/* Listing agent / brokerage attribution */}
                  {(() => {
                    const agent = property.rawData?.ListAgentFullName as string | undefined;
                    const office = property.rawData?.ListOfficeName as string | undefined;
                    const license = property.rawData?.ListAgentStateLicense as string | undefined;
                    return (
                      <div className="mt-4 flex items-center gap-1.5 text-xs text-white/50">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#9E8C61]/70" />
                        {agent || office ? (
                          <span>
                            {agent && <span>Listed by <span className="text-white/70">{agent}</span></span>}
                            {agent && license && <span className="text-white/30"> · DRE #{license}</span>}
                            {office && <span>{agent ? " · " : "Listed by "}<span className="text-white/70">{office}</span></span>}
                          </span>
                        ) : (
                          <span>Listing courtesy of California Regional MLS</span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Details grid */}
                  <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-xl bg-[#1a1a1a] p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/50">MLS #</span>
                      <span className="text-white">{property.mlsNumber}</span>
                    </div>
                    {property.propertyType && (
                      <div className="flex justify-between">
                        <span className="text-white/50">Type</span>
                        <span className="text-white">{property.propertyType}</span>
                      </div>
                    )}
                    {property.lotSize != null && (
                      <div className="flex justify-between">
                        <span className="text-white/50">Lot Size</span>
                        <span className="text-white">{property.lotSize.toLocaleString()} sqft</span>
                      </div>
                    )}
                    {property.yearBuilt != null && (
                      <div className="flex justify-between">
                        <span className="text-white/50">Year Built</span>
                        <span className="text-white">{property.yearBuilt}</span>
                      </div>
                    )}
                    {property.county && (
                      <div className="flex justify-between">
                        <span className="text-white/50">County</span>
                        <span className="text-white">{property.county}</span>
                      </div>
                    )}
                    {property.listedAt && (
                      <div className="flex justify-between">
                        <span className="text-white/50">Listed</span>
                        <span className="text-white">
                          {new Date(property.listedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* MLS Compliance */}
                  <div className="mt-6 rounded-xl border border-white/10 bg-[#1a1a1a] p-4 text-xs text-white/40">
                    <div className="mb-2 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#9E8C61]/70" />
                      <span className="font-medium uppercase tracking-wide text-white/50">
                        Listing Information
                      </span>
                    </div>
                    <p className="leading-relaxed">
                      <span className="font-medium text-white/50">MLS #:</span>{" "}
                      {property.mlsNumber} &nbsp;·&nbsp;{" "}
                      <span className="font-medium text-white/50">Status:</span>{" "}
                      {property.status} &nbsp;·&nbsp;{" "}
                      <span className="font-medium text-white/50">Courtesy of:</span>{" "}
                      California Regional MLS (CRMLS)
                    </p>
                    <p className="mt-2 leading-relaxed">
                      Based on information from the California Regional Multiple Listing
                      Service (CRMLS) as of{" "}
                      {property.syncedAt
                        ? new Date(property.syncedAt).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "the date listed above"}
                      . All data has not been, and will not be, verified by broker or MLS.
                      All information should be independently reviewed and verified for
                      accuracy.
                    </p>
                    <p className="mt-2 leading-relaxed">
                      This information is for the consumer&apos;s personal,
                      non-commercial use only and may not be used for any purpose other
                      than to identify prospective properties the consumer may be
                      interested in purchasing.
                    </p>
                  </div>
                </div>

                {/* Right: contact + calculator (hidden below ~700px drawer width) */}
                <div className="hidden w-64 shrink-0 flex-col gap-4 xl:flex">
                  <ContactForm mlsNumber={property.mlsNumber} address={property.address} />
                  <MortgageCalculator listPrice={property.listPrice} />
                </div>
              </div>

              {/* Contact + calculator stacked (visible at narrower drawer widths) */}
              <div className="mt-6 flex flex-col gap-4 px-6 xl:hidden">
                <ContactForm mlsNumber={property.mlsNumber} address={property.address} />
                <MortgageCalculator listPrice={property.listPrice} />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
