"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { AgentAboutLineArt } from "./AgentAboutLineArt";
import { Phone } from "lucide-react";
import { StatCards } from "./StatCards";
import type { StatCardData } from "./StatCards";

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

function LiIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 8C17.5913 8 19.1174 8.63214 20.2426 9.75736C21.3679 10.8826 22 12.4087 22 14V21H18V14C18 13.4696 17.7893 12.9609 17.4142 12.5858C17.0391 12.2107 16.5304 12 16 12C15.4696 12 14.9609 12.2107 14.5858 12.5858C14.2107 12.9609 14 13.4696 14 14V21H10V14C10 12.4087 10.6321 10.8826 11.7574 9.75736C12.8826 8.63214 14.4087 8 16 8Z"/>
      <path d="M6 9H2V21H6V9Z"/>
      <path d="M4 6C5.10457 6 6 5.10457 6 4C6 2.89543 5.10457 2 4 2C2.89543 2 2 2.89543 2 4C2 5.10457 2.89543 6 4 6Z"/>
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
  specialties: string[];
  phone: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
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
  specialties,
  phone,
  instagram,
  facebook,
  linkedin,
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
          <div className="md:w-[38%]">
            <div className="sticky top-28">
              {/* Large agent photo — hidden until morph animation hands off */}
              <div
                ref={onPhotoRef}
                className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[#2A2A2A]"
                style={{ visibility: photoVisible ? "visible" : "hidden" }}
              >
                {headshot ? (
                  <Image
                    src={headshot}
                    alt={displayName}
                    fill
                    sizes="(max-width: 768px) 100vw, 40vw"
                    quality={95}
                    className="object-cover object-top"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-sans text-6xl font-light text-white/15">
                    {displayName[0]?.toUpperCase()}
                  </div>
                )}
              </div>

              {/* Social icons */}
              {(instagram || facebook || linkedin) && (
                <div className="mt-5 flex items-center gap-2.5">
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
                  {linkedin && (
                    <a
                      href={socialHref(linkedin, "https://linkedin.com/in/")}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="LinkedIn"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/55 transition-colors hover:border-white/45 hover:text-white"
                    >
                      <LiIcon />
                    </a>
                  )}
                </div>
              )}

              {licenseNum && (
                <p className="mt-3 font-sans text-xs text-white/30">
                  {licenseState ?? "CA"} DRE #{licenseNum}
                </p>
              )}
            </div>
          </div>

          {/* RIGHT — scrollable bio content */}
          <motion.div
            className="md:w-[62%] md:py-4"
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <p className="mb-3 font-sans text-xs font-medium uppercase tracking-widest text-[#9E8C61]">
              About Me
            </p>
            <h2
              className="mb-8 font-sans font-medium leading-[1.1] text-white"
              style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)", letterSpacing: "-0.02em" }}
            >
              I&rsquo;m {displayName},{" "}
              <span className="text-white/40">
                a Licensed {title ?? "Real Estate Agent"}
              </span>
            </h2>

            {bio ? (
              <div className="space-y-5">
                {bio.split(/\n\n+/).map((para, i) => (
                  <p
                    key={i}
                    className="font-sans text-base leading-relaxed text-white/62"
                  >
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <p className="font-sans text-base leading-relaxed text-white/62">
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
