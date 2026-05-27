"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Loader2, Heart } from "lucide-react";
import Link from "next/link";
import { ContactForm } from "./ContactForm";
import { MortgageCalculator } from "./MortgageCalculator";
import { AgentAttribution } from "./AgentAttribution";
import { CrmlsDisclaimer } from "./CrmlsDisclaimer";
import { buildStatsFields, buildDetailSections } from "@/lib/property-ui-helpers";
import { useSavedProperties } from "@/hooks/useSavedProperties";

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
  photos: string[] | null;
  listAgentName: string | null;
  listAgentLicense: string | null;
  listOfficeName: string | null;
  details: Record<string, unknown> | null;
  listedAt: string | null;
  syncedAt: string | null;
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
    const controller = new AbortController();
    setIsLoading(true);
    setIsError(false);
    setPhotoIdx(0);
    setProperty(null);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    fetch(`/api/properties/${mlsNumber}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => setProperty(data))
      .catch((err) => {
        if (err.name !== "AbortError") setIsError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [mlsNumber]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { savedSet, toggle } = useSavedProperties();
  const photos = Array.isArray(property?.photos) ? property!.photos : [];
  const statsFields = property ? buildStatsFields(property) : [];
  const detailSections = property ? buildDetailSections((property.details as Record<string, unknown>) ?? {}, property.lotSize) : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 bg-black/40"
        style={{ top: "64px" }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed bottom-0 right-0 z-50 flex flex-col overflow-hidden bg-[#F2F0EF] shadow-2xl"
        style={{ top: "64px", width: "min(880px, 63vw)" }}
      >
        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between bg-[#1B1B1B] px-5 py-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/10"
          >
            <X className="h-4 w-4" />
            Back to search
          </button>
          {property && (
            <Link
              href={`/properties/${property.mlsNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white transition-colors hover:text-white/70"
            >
              Open full page ↗
            </Link>
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
            <div className="flex h-64 items-center justify-center text-sm text-red-600">
              Failed to load listing. Please try again.
            </div>
          )}

          {!isLoading && !isError && property && (
            <div className="pb-10">
              {/* Photo carousel */}
              <div className="relative h-72 w-full bg-[#1B1B1B]/10 sm:h-80 md:h-96">
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
                          aria-label="Previous photo"
                          onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          aria-label="Next photo"
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
                  <div className="flex h-full items-center justify-center text-sm text-[#1B1B1B]/50">No photos</div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  {property.status}
                </span>
                <button
                  onClick={() => toggle(property.mlsNumber)}
                  className="absolute right-3 top-3 rounded-full bg-black/50 p-2 backdrop-blur-sm transition-colors hover:bg-black/70"
                  aria-label={savedSet.has(property.mlsNumber) ? "Remove from saved" : "Save property"}
                >
                  <Heart
                    className={`h-5 w-5 transition-colors ${
                      savedSet.has(property.mlsNumber) ? "fill-[#9E8C61] text-[#9E8C61]" : "text-white"
                    }`}
                  />
                </button>
              </div>

              {/* Content: two columns at wider widths */}
              <div className="flex gap-6 px-6 pt-6">
                {/* Left: main details */}
                <div className="min-w-0 flex-1">
                  {/* Header */}
                  <h1 className="text-2xl font-bold text-[#1B1B1B]">
                    ${property.listPrice.toLocaleString()}
                  </h1>
                  <p className="mt-1 text-base text-[#1B1B1B]/80">{property.address}</p>
                  <p className="text-sm text-[#1B1B1B]/70">
                    {property.city}, {property.state} {property.zip}
                  </p>

                  {/* Stats grid */}
                  {statsFields.length > 0 && (
                    <div className="mt-4 overflow-hidden rounded-xl bg-cnc-bg">
                      <div className="grid grid-cols-3">
                        {statsFields.map(({ icon: Icon, label, value }) => (
                          <div key={label} className="flex items-center gap-2.5 px-4 py-3.5">
                            <Icon className="h-4 w-4 shrink-0 text-[#9E8C61]" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#1B1B1B]" title={String(value)}>{value}</p>
                              <p className="text-[11px] text-[#1B1B1B]/60">{label}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {property.description && (
                    <div className="mt-5">
                      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#1B1B1B]/70">
                        About this home
                      </h2>
                      <p className="text-sm leading-relaxed text-[#1B1B1B]/80">
                        {property.description}
                      </p>
                    </div>
                  )}

                  <AgentAttribution
                    listAgentName={property.listAgentName}
                    listAgentLicense={property.listAgentLicense}
                    listOfficeName={property.listOfficeName}
                    className="mt-4 flex items-center gap-1.5 text-xs text-[#1B1B1B]/70"
                    iconClassName="h-3.5 w-3.5 shrink-0 text-[#9E8C61]/70"
                  />

                  {/* MLS # and Listed date */}
                  <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-xl bg-cnc-bg p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#1B1B1B]/70">MLS #</span>
                      <span className="text-[#1B1B1B]">{property.mlsNumber}</span>
                    </div>
                    {property.listedAt && (
                      <div className="flex justify-between">
                        <span className="text-[#1B1B1B]/70">Listed</span>
                        <span className="text-[#1B1B1B]">
                          {new Date(property.listedAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Extended Property Details */}
                  <div className="mt-5 space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/50">
                      Property Details
                    </h2>
                    {detailSections.map((section) => (
                      <div key={section.title} className="rounded-xl bg-cnc-bg p-4">
                        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#1B1B1B]/60">
                          {section.title}
                        </h3>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                          {section.fields.map(([label, value]) => (
                            <div key={label} className="flex justify-between gap-2">
                              <span className="text-sm text-[#1B1B1B]/70">{label}</span>
                              <span className="text-right text-sm text-[#1B1B1B]">
                                {value != null && value !== "" && value !== false ? String(value) : "N/A"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
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

              {/* Disclaimer */}
              <div className="mt-8 px-10 pb-6 text-center text-xs leading-relaxed">
                <CrmlsDisclaimer syncedAt={property.syncedAt} className="text-[#1B1B1B]/50" />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
