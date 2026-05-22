import Image from "next/image";

type AgentProfileHeroProps = {
  displayName: string | null;
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
};

export function AgentProfileHero(props: AgentProfileHeroProps) {
  const {
    displayName, headshot, bio, licenseNum, licenseState,
    yearsExp, specialties, phone, instagram, facebook, linkedin,
    listingsClosed, volumeClosed,
  } = props;

  const volumeFormatted =
    volumeClosed >= 1_000_000
      ? `$${(volumeClosed / 1_000_000).toFixed(1)}M`
      : `$${volumeClosed.toLocaleString()}`;

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
          {/* Headshot */}
          <div className="relative h-40 w-40 flex-shrink-0 overflow-hidden rounded-full bg-[#F2F0EF]">
            {headshot ? (
              <Image src={headshot} alt={displayName ?? "Agent"} fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-sans text-5xl font-light text-[#1B1B1B]/20">
                  {(displayName ?? "A")[0].toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="font-sans text-3xl font-light text-[#1B1B1B]">
              {displayName ?? "CnC Realty Agent"}
            </h1>
            <p className="mt-1 font-sans text-sm text-[#9E8C61]">
              Real Estate Agent · CnC Realty Group
            </p>
            {(licenseNum || licenseState) && (
              <p className="mt-1 font-sans text-xs text-[#1B1B1B]/50">
                License {licenseNum ?? "—"} · {licenseState ?? "CA"}
              </p>
            )}
            {phone && (
              <a
                href={`tel:${phone}`}
                className="mt-3 inline-block font-sans text-sm text-[#1B1B1B] transition-colors hover:text-[#9E8C61]"
              >
                {phone}
              </a>
            )}
            <div className="mt-3 flex items-center justify-center gap-4 md:justify-start">
              {instagram && (
                <a href={instagram} target="_blank" rel="noopener noreferrer" className="font-sans text-xs text-[#1B1B1B]/40 transition-colors hover:text-[#9E8C61]">
                  Instagram
                </a>
              )}
              {facebook && (
                <a href={facebook} target="_blank" rel="noopener noreferrer" className="font-sans text-xs text-[#1B1B1B]/40 transition-colors hover:text-[#9E8C61]">
                  Facebook
                </a>
              )}
              {linkedin && (
                <a href={linkedin} target="_blank" rel="noopener noreferrer" className="font-sans text-xs text-[#1B1B1B]/40 transition-colors hover:text-[#9E8C61]">
                  LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-10 grid grid-cols-3 gap-4 border-t border-[#1B1B1B]/5 pt-8">
          {[
            { label: "Listings Closed", value: listingsClosed.toString() },
            { label: "Volume Closed", value: volumeFormatted },
            { label: "Years Experience", value: yearsExp !== null ? yearsExp.toString() : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="font-sans text-2xl font-light text-[#1B1B1B]">{value}</p>
              <p className="mt-0.5 font-sans text-xs text-[#1B1B1B]/50">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bio + Specialties */}
      {(bio || specialties.length > 0) && (
        <div className="bg-[#F2F0EF] py-12">
          <div className="mx-auto max-w-5xl px-6">
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
        </div>
      )}
    </div>
  );
}
