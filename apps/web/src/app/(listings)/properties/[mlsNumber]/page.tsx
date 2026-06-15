import { notFound } from "next/navigation";
import { Metadata } from "next";

export const revalidate = 300;
import { prisma } from "@/lib/prisma";
import { buildStatsFields, buildDetailSections } from "@/lib/property-ui-helpers";
import { formatPropertyStatus } from "@/types/property";
import { PhotoGallery } from "@/components/properties/PhotoGallery";
import { MortgageCalculator } from "@/components/properties/MortgageCalculator";
import { ContactForm } from "@/components/properties/ContactForm";
import { BackLink } from "@/components/properties/BackLink";
import { AgentAttribution } from "@/components/properties/AgentAttribution";
import { CrmlsDisclaimer } from "@/components/properties/CrmlsDisclaimer";
import { SaveButton } from "@/components/properties/SaveButton";

interface PageProps {
  params: { mlsNumber: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  let property = null;
  try {
    property = await prisma.property.findUnique({
      where: { mlsNumber: params.mlsNumber },
      select: { address: true, city: true, state: true, listPrice: true, photos: true, description: true },
    });
  } catch {
    return { title: "Property" };
  }

  if (!property) return { title: "Property Not Found" };

  const photos = Array.isArray(property.photos) ? (property.photos as string[]) : [];
  const title = `${property.address}, ${property.city}, ${property.state}`;

  return {
    title,
    description: property.description ?? `${title} — $${property.listPrice.toLocaleString()}`,
    openGraph: {
      title,
      description: `$${property.listPrice.toLocaleString()} · ${title}`,
      images: photos[0] ? [{ url: photos[0], width: 1200, height: 630 }] : [],
    },
  };
}

export default async function PropertyDetailPage({ params }: PageProps) {
  let property = null;
  try {
    property = await prisma.property.findUnique({ where: { mlsNumber: params.mlsNumber } });
  } catch {
    return (
      <div data-navbar-theme="light" className="flex min-h-screen items-center justify-center bg-[#F2F0EF]">
        <div className="text-center">
          <p className="text-lg font-light text-[#1B1B1B]">Unable to load this listing right now.</p>
          <p className="mt-2 text-sm text-[#1B1B1B]/50">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }
  if (!property) notFound();

  const photos = Array.isArray(property.photos) ? (property.photos as string[]) : [];
  const statsFields = buildStatsFields(property);
  const detailSections = buildDetailSections((property.details as Record<string, unknown>) ?? {}, property.lotSize);

  return (
    <div data-navbar-theme="light" className="min-h-screen bg-[#F2F0EF] pb-20 text-[#1B1B1B]">
      {/* Dark header bar */}
      <div data-navbar-theme="dark" className="bg-[#1B1B1B] pb-3 pt-[76px]">
        <div className="mx-auto max-w-7xl px-4">
          <BackLink />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-6">
        <PhotoGallery photos={photos} address={property.address} />

        <div className="mt-8 flex gap-8">
          {/* Left: listing details */}
          <div className="min-w-0 flex-1">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">${property.listPrice.toLocaleString()}</h1>
                <p className="mt-1 text-lg text-[#1B1B1B]/80">{property.address}</p>
                <p className="text-sm text-[#1B1B1B]/70">{property.city}, {property.state} {property.zip}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <SaveButton mlsNumber={property.mlsNumber} />
                <span className="rounded-full bg-[#9E8C61]/20 px-3 py-1 text-sm text-[#9E8C61]">
                  {formatPropertyStatus(property.status)}
                </span>
              </div>
            </div>

            {/* Stats grid */}
            {statsFields.length > 0 && (
              <div className="mt-5 overflow-hidden rounded-xl bg-cnc-bg">
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
              <div className="mt-6">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#1B1B1B]/70">About this home</h2>
                <p className="leading-relaxed text-[#1B1B1B]/80">{property.description}</p>
              </div>
            )}

            <AgentAttribution
              listAgentName={property.listAgentName}
              listAgentLicense={property.listAgentLicense}
              listOfficeName={property.listOfficeName}
            />

            {/* MLS # and Listed date */}
            <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2.5 rounded-xl bg-cnc-bg p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-[#1B1B1B]/70">MLS #</span>
                <span>{property.mlsNumber}</span>
              </div>
              {property.listedAt && (
                <div className="flex justify-between">
                  <span className="text-[#1B1B1B]/70">Listed</span>
                  <span>
                    {new Date(property.listedAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Property Details sections */}
            <div className="mt-6 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/50">Property Details</h2>
              {detailSections.map((section) => (
                <div key={section.title} className="rounded-xl bg-cnc-bg p-4">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#1B1B1B]/60">
                    {section.title}
                  </h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
                    {section.fields.map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-2">
                        <span className="text-[#1B1B1B]/70">{label}</span>
                        <span className="text-right text-[#1B1B1B]">
                          {value != null && value !== "" && value !== false ? String(value) : "N/A"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: sticky sidebar */}
          <div className="w-80 shrink-0">
            <div className="sticky top-24 flex flex-col gap-4">
              <ContactForm mlsNumber={property.mlsNumber} address={property.address} />
              <MortgageCalculator listPrice={property.listPrice} />
            </div>
          </div>
        </div>

        {/* Disclaimer — full width, centered */}
        <div className="mt-12 text-center text-xs leading-relaxed">
          <CrmlsDisclaimer
            syncedAt={property.syncedAt ? property.syncedAt.toISOString() : null}
            className="text-[#1B1B1B]/40"
          />
        </div>
      </div>
    </div>
  );
}
