import Image from "next/image";
import { Clock, Home, TrendingUp, KeyRound } from "lucide-react";
import type { ReactNode } from "react";

type AgentProfileHeroProps = {
  displayName: string | null;
  title: string | null;
  headshot: string | null;
  bio: string | null;
  licenseNum: string | null;
  licenseState: string | null;
  yearsExp: number | null;
  specialties: string[];
  phone: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  listingsClosed: number;
  volumeClosed: number;
  propertiesRented: number;
};

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v.toLocaleString()}`;
}

type StatCard = { icon: ReactNode; value: string; label: string };

export function AgentProfileHero({
  displayName,
  title,
  headshot,
  bio,
  licenseNum,
  licenseState,
  yearsExp,
  specialties,
  listingsClosed,
  volumeClosed,
  propertiesRented,
}: AgentProfileHeroProps) {
  const name = displayName ?? "CnC Realty Agent";

  const stats: StatCard[] = [
    {
      icon: <Clock size={28} color="white" strokeWidth={1.5} />,
      value: yearsExp !== null ? yearsExp.toString() : "—",
      label: "Years of Experience",
    },
    {
      icon: <Home size={28} color="white" strokeWidth={1.5} />,
      value: listingsClosed > 0 ? listingsClosed.toString() : "—",
      label: "Listings Closed",
    },
    {
      icon: <TrendingUp size={28} color="white" strokeWidth={1.5} />,
      value: volumeClosed > 0 ? formatVolume(volumeClosed) : "—",
      label: "Volume Closed",
    },
    {
      icon: <KeyRound size={28} color="white" strokeWidth={1.5} />,
      value: propertiesRented > 0 ? propertiesRented.toString() : "—",
      label: "Properties Rented",
    },
  ];

  return (
    <>
      {/* ── Hero: light section with inline-photo heading ── */}
      <section className="bg-[#F2F0EF] px-6 pb-16 pt-28 md:px-12 md:pb-20 lg:px-20">
        <div className="mx-auto max-w-5xl">
          <h1
            className="font-sans font-medium leading-[1.1] text-[#151717]"
            style={{ fontSize: "clamp(2.4rem, 5.5vw, 5rem)", letterSpacing: "-0.03em" }}
          >
            {/* "I'm [photo]" kept together so they never break across lines */}
            <span style={{ whiteSpace: "nowrap" }}>
              {"I'm "}
              {/* Inline circular photo — size matches spacer so text wraps around it */}
              <span
                className="relative inline-block overflow-hidden rounded-full bg-[#E0DDD8] align-middle"
                style={{
                  width: "clamp(3rem, 7.5vw, 6.5rem)",
                  height: "clamp(3rem, 7.5vw, 6.5rem)",
                  top: "-0.05em",
                  margin: "0 0.15em",
                }}
              >
                {headshot ? (
                  <Image
                    src={headshot}
                    alt={name}
                    fill
                    sizes="104px"
                    quality={95}
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-sans text-xl font-light text-[#1B1B1B]/30">
                    {name[0].toUpperCase()}
                  </span>
                )}
              </span>
            </span>
            {name}, a Licensed{" "}
            <span style={{ color: "#9B9B9B" }}>{title ?? "Real Estate Agent"}</span>
          </h1>

          {licenseNum && (
            <p className="mt-5 font-sans text-sm text-[#1B1B1B]/45">
              CA DRE #{licenseNum}
              {licenseState ? ` · ${licenseState}` : ""}
            </p>
          )}
        </div>
      </section>

      {/* ── Stats: dark section with 4 cards ── */}
      <section className="bg-[#151717] px-6 py-10 md:px-12 lg:px-20">
        <div className="mx-auto max-w-5xl">
          {/* Mobile: horizontal snap-scroll; desktop: 4-col grid */}
          <div
            className="flex gap-2.5 overflow-x-auto pb-1 [scroll-snap-type:x_mandatory] md:grid md:grid-cols-4 md:overflow-visible md:pb-0"
            style={{ scrollbarWidth: "none" }}
          >
            {stats.map(({ icon, value, label }) => (
              <div
                key={label}
                className="flex min-w-[200px] flex-shrink-0 [scroll-snap-align:start] flex-col rounded-2xl p-6 md:aspect-square md:min-w-0"
                style={{
                  backgroundColor: "rgba(33,33,33,0.9)",
                  border: "1px solid rgba(179,179,179,0.1)",
                }}
              >
                <div>{icon}</div>
                <div className="mt-auto pt-8">
                  <p className="font-sans text-3xl font-medium leading-none text-white md:text-4xl">
                    {value}
                  </p>
                  <p className="mt-2 font-sans text-xs font-medium text-[#9B9B9B] md:text-sm">
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bio + Specialties ── */}
      {(bio || specialties.length > 0) && (
        <section className="bg-[#F2F0EF] py-12">
          <div className="mx-auto max-w-5xl px-6 md:px-12 lg:px-20">
            {bio && (
              <div className="mb-6">
                <h2 className="mb-3 font-sans text-xs font-medium uppercase tracking-widest text-[#9E8C61]">
                  About
                </h2>
                <p className="font-sans text-base leading-relaxed text-[#1B1B1B]/80">{bio}</p>
              </div>
            )}
            {specialties.length > 0 && (
              <div>
                <h2 className="mb-3 font-sans text-xs font-medium uppercase tracking-widest text-[#9E8C61]">
                  Specialties
                </h2>
                <div className="flex flex-wrap gap-2">
                  {specialties.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-[#9E8C61]/30 px-3 py-1 font-sans text-xs text-[#1B1B1B]/70"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
