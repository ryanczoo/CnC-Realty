import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PhotoGallery } from "@/components/properties/PhotoGallery";
import { MortgageCalculator } from "@/components/properties/MortgageCalculator";
import { ContactForm } from "@/components/properties/ContactForm";
import { BackLink } from "@/components/properties/BackLink";
import { BedDouble, Bath, Ruler, Calendar, MapPin } from "lucide-react";

interface PageProps {
  params: { mlsNumber: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const property = await prisma.property.findUnique({
    where: { mlsNumber: params.mlsNumber },
    select: {
      address: true,
      city: true,
      state: true,
      listPrice: true,
      photos: true,
      description: true,
    },
  });

  if (!property) return { title: "Property Not Found" };

  const photos = Array.isArray(property.photos)
    ? (property.photos as string[])
    : [];
  const title = `${property.address}, ${property.city}, ${property.state}`;

  return {
    title,
    description:
      property.description ??
      `${title} — $${property.listPrice.toLocaleString()}`,
    openGraph: {
      title,
      description: `$${property.listPrice.toLocaleString()} · ${title}`,
      images: photos[0] ? [{ url: photos[0], width: 1200, height: 630 }] : [],
    },
  };
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const property = await prisma.property.findUnique({
    where: { mlsNumber: params.mlsNumber },
  });

  if (!property) notFound();

  const photos = Array.isArray(property.photos)
    ? (property.photos as string[])
    : [];

  const facts = [
    property.beds != null && {
      icon: BedDouble,
      label: "Beds",
      value: property.beds,
    },
    property.baths != null && {
      icon: Bath,
      label: "Baths",
      value: property.baths,
    },
    property.sqft != null && {
      icon: Ruler,
      label: "Sq Ft",
      value: property.sqft.toLocaleString(),
    },
    property.yearBuilt != null && {
      icon: Calendar,
      label: "Year Built",
      value: property.yearBuilt,
    },
  ].filter(Boolean) as {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
  }[];

  return (
    <div className="min-h-screen bg-[#0f0f0f] pb-20 text-white">
      <div className="mx-auto max-w-7xl px-4 pt-6">
        {/* Back to search */}
        <BackLink />

        {/* Photo gallery */}
        <div className="mt-4">
          <PhotoGallery photos={photos} address={property.address} />
        </div>

        {/* Two-column layout */}
        <div className="mt-8 flex gap-8">
          {/* Left: listing details */}
          <div className="min-w-0 flex-1">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">
                  ${property.listPrice.toLocaleString()}
                </h1>
                <p className="mt-1 text-lg text-white/70">{property.address}</p>
                <p className="text-sm text-white/50">
                  {property.city}, {property.state} {property.zip}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[#9E8C61]/20 px-3 py-1 text-sm text-[#9E8C61]">
                {property.status}
              </span>
            </div>

            {/* Key facts pills */}
            {facts.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-3">
                {facts.map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-4 py-2.5"
                  >
                    <Icon className="h-4 w-4 text-[#9E8C61]" />
                    <div>
                      <p className="text-xs text-white/40">{label}</p>
                      <p className="text-sm font-semibold">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Listing details grid */}
            <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 rounded-2xl bg-[#1a1a1a] p-5 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">MLS #</span>
                <span>{property.mlsNumber}</span>
              </div>
              {property.propertyType && (
                <div className="flex justify-between">
                  <span className="text-white/50">Type</span>
                  <span>{property.propertyType}</span>
                </div>
              )}
              {property.lotSize != null && (
                <div className="flex justify-between">
                  <span className="text-white/50">Lot Size</span>
                  <span>{property.lotSize.toLocaleString()} sqft</span>
                </div>
              )}
              {property.yearBuilt != null && (
                <div className="flex justify-between">
                  <span className="text-white/50">Year Built</span>
                  <span>{property.yearBuilt}</span>
                </div>
              )}
              {property.county && (
                <div className="flex justify-between">
                  <span className="text-white/50">County</span>
                  <span>{property.county}</span>
                </div>
              )}
              {property.listedAt && (
                <div className="flex justify-between">
                  <span className="text-white/50">Listed</span>
                  <span>
                    {new Date(property.listedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            {property.description && (
              <div className="mt-6">
                <h2 className="mb-3 text-lg font-semibold">About this home</h2>
                <p className="leading-relaxed text-white/70">
                  {property.description}
                </p>
              </div>
            )}

            {/* Location */}
            {property.latitude != null && property.longitude != null && (
              <div className="mt-6 flex items-center gap-2 text-sm text-white/50">
                <MapPin className="h-4 w-4 text-[#9E8C61]" />
                {property.address}, {property.city}, {property.state}
              </div>
            )}
          </div>

          {/* Right: sticky sidebar */}
          <div className="w-80 shrink-0">
            <div className="sticky top-24 flex flex-col gap-4">
              <ContactForm
                mlsNumber={property.mlsNumber}
                address={property.address}
              />
              <MortgageCalculator listPrice={property.listPrice} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
