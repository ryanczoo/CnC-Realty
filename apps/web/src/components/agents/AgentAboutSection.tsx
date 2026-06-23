"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { AgentAboutLineArt } from "./AgentAboutLineArt";
import { Phone } from "lucide-react";
import { StatCards } from "./StatCards";
import type { StatCardData } from "./StatCards";

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M2 6C2 4.89543 2.89543 4 4 4H20C21.1046 4 22 4.89543 22 6V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V6ZM4 6L12 13L20 6H4ZM4 8.41421V18H20V8.41421L12 15.4142L4 8.41421Z" fill="currentColor"/>
    </svg>
  );
}

function IgIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" fill="currentColor"/>
      <path d="M18 5C17.4477 5 17 5.44772 17 6C17 6.55228 17.4477 7 18 7C18.5523 7 19 6.55228 19 6C19 5.44772 18.5523 5 18 5Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M1.65396 4.27606C1 5.55953 1 7.23969 1 10.6V13.4C1 16.7603 1 18.4405 1.65396 19.7239C2.2292 20.8529 3.14708 21.7708 4.27606 22.346C5.55953 23 7.23969 23 10.6 23H13.4C16.7603 23 18.4405 23 19.7239 22.346C20.8529 21.7708 21.7708 20.8529 22.346 19.7239C23 18.4405 23 16.7603 23 13.4V10.6C23 7.23969 23 5.55953 22.346 4.27606C21.7708 3.14708 20.8529 2.2292 19.7239 1.65396C18.4405 1 16.7603 1 13.4 1H10.6C7.23969 1 5.55953 1 4.27606 1.65396C3.14708 2.2292 2.2292 3.14708 1.65396 4.27606ZM13.4 3H10.6C8.88684 3 7.72225 3.00156 6.82208 3.0751C5.94524 3.14674 5.49684 3.27659 5.18404 3.43597C4.43139 3.81947 3.81947 4.43139 3.43597 5.18404C3.27659 5.49684 3.14674 5.94524 3.0751 6.82208C3.00156 7.72225 3 8.88684 3 10.6V13.4C3 15.1132 3.00156 16.2777 3.0751 17.1779C3.14674 18.0548 3.27659 18.5032 3.43597 18.816C3.81947 19.5686 4.43139 20.1805 5.18404 20.564C5.49684 20.7234 5.94524 20.8533 6.82208 20.9249C7.72225 20.9984 8.88684 21 10.6 21H13.4C15.1132 21 16.2777 20.9984 17.1779 20.9249C18.0548 20.8533 18.5032 20.7234 18.816 20.564C19.5686 20.1805 20.1805 19.5686 20.564 18.816C20.7234 18.5032 20.8533 18.0548 20.9249 17.1779C20.9984 16.2777 21 15.1132 21 13.4V10.6C21 8.88684 20.9984 7.72225 20.9249 6.82208C20.8533 5.94524 20.7234 5.49684 20.564 5.18404C20.1805 4.43139 19.5686 3.81947 18.816 3.43597C18.5032 3.27659 18.0548 3.14674 17.1779 3.0751C16.2777 3.00156 15.1132 3 13.4 3Z" fill="currentColor"/>
    </svg>
  );
}

function FbIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.03998C6.5 2.03998 2 6.52998 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.84998C10.44 7.33998 11.93 5.95998 14.22 5.95998C15.31 5.95998 16.45 6.14998 16.45 6.14998V8.61998H15.19C13.95 8.61998 13.56 9.38998 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96C15.9164 21.5878 18.0622 20.3855 19.6099 18.57C21.1576 16.7546 22.0054 14.4456 22 12.06C22 6.52998 17.5 2.03998 12 2.03998Z"/>
    </svg>
  );
}

// Overlapping diamond outlines — matches FIND's dark section watermark

type Props = {
  displayName: string;
  title: string | null;
  headshot: string | null;
  bio: string | null;
  licenseNum: string | null;
  licenseState: string | null;
  location?: string | null;
  language?: string | null;
  specialties: string[];
  phone: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  stats: StatCardData[];
  onPhotoRef?: (el: HTMLDivElement | null) => void;
  photoVisible?: boolean;
};

function socialHref(raw: string, base: string) {
  return raw.startsWith("http") ? raw : `${base}${raw}`;
}

export function AgentAboutSection({
  displayName,
  title,
  headshot,
  bio,
  licenseNum,
  licenseState,
  location,
  language,
  specialties,
  phone,
  email,
  instagram,
  facebook,
  stats,
  onPhotoRef,
  photoVisible = false,
}: Props) {
  return (
    <section className="relative bg-[#1B1B1B]">
      <AgentAboutLineArt />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24 lg:px-12">
        <div className="flex flex-col gap-12 md:flex-row md:gap-16 lg:gap-24">

          {/* LEFT — sticky photo column */}
          <div className="md:w-[29%]">
            <div className="sticky top-28">
              {/* Large agent photo — hidden until morph animation hands off */}
              <div
                ref={onPhotoRef}
                className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[#E0DDD8]"
                style={{ visibility: photoVisible ? "visible" : "hidden" }}
              >
                {headshot ? (
                  <Image
                    src={headshot}
                    alt={displayName}
                    fill
                    sizes="(max-width: 768px) 100vw, 30vw"
                    quality={95}
                    className="object-cover object-top"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-sans text-6xl font-light text-[#1B1B1B]/30">
                    {displayName[0]?.toUpperCase()}
                  </div>
                )}
              </div>

              {/* Social icons */}
              {(email || instagram || facebook) && (
                <div className="mt-5 flex items-center gap-2.5">
                  {email && (
                    <a
                      href={`mailto:${email}`}
                      aria-label="Email"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/55 transition-colors hover:border-white/45 hover:text-white"
                    >
                      <EmailIcon />
                    </a>
                  )}
                  {instagram && (
                    <a
                      href={socialHref(instagram, "https://instagram.com/")}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/55 transition-colors hover:border-white/45 hover:text-white"
                    >
                      <IgIcon />
                    </a>
                  )}
                  {facebook && (
                    <a
                      href={socialHref(facebook, "https://facebook.com/")}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Facebook"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/55 transition-colors hover:border-white/45 hover:text-white"
                    >
                      <FbIcon />
                    </a>
                  )}
                </div>
              )}

              {/* Location / Language / License fields */}
              <div className="mt-6 space-y-5">
                {location && (
                  <div>
                    <p className="font-sans text-xs uppercase tracking-widest text-white/40">Location</p>
                    <p className="mt-1 font-sans text-sm font-medium text-white">{location}</p>
                  </div>
                )}
                {language && (
                  <div>
                    <p className="font-sans text-xs uppercase tracking-widest text-white/40">Language</p>
                    <p className="mt-1 font-sans text-sm font-medium text-white">{language}</p>
                  </div>
                )}
                {licenseNum && (
                  <div>
                    <p className="font-sans text-xs uppercase tracking-widest text-white/40">License</p>
                    <p className="mt-1 font-sans text-sm font-medium text-white">DRE #{licenseNum}</p>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* RIGHT — scrollable bio content */}
          <motion.div
            className="md:w-[71%] md:py-4 md:pl-16 lg:pl-24"
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <p className="mb-3 font-sans text-xs font-medium uppercase tracking-widest text-[#9E8C61]">
              About {displayName.split(" ")[0]}
            </p>
            {bio ? (
              <div className="space-y-5">
                {bio.split(/\n\n+/).map((para, i) => (
                  <p
                    key={i}
                    className="font-sans text-4xl font-medium leading-relaxed text-white/62"
                  >
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <p className="font-sans text-4xl font-medium leading-relaxed text-white/62">
                Dedicated to helping clients buy, sell, and invest in real estate
                across Southern California with integrity and expertise.
              </p>
            )}

            {specialties.length > 0 && (
              <div className="mt-9">
                <p className="mb-3 font-sans text-xs font-medium uppercase tracking-widest text-white/30">
                  Specialties
                </p>
                <div className="flex flex-wrap gap-2">
                  {specialties.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-white/15 px-3 py-1 font-sans text-xs text-white/50"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Stat cards — full section width, between bio and CTA */}
        <div className="mt-12">
          <StatCards stats={stats} />
        </div>

        {/* CTA buttons */}
        {phone && (
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 font-sans text-sm text-white/75 transition-colors hover:border-white/45 hover:text-white"
            >
              <Phone size={14} />
              {phone}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
