"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useScroll, useMotionValueEvent } from "motion/react";
import { AgentPhotoMorph } from "./AgentPhotoMorph";
import type { MorphRect } from "./AgentPhotoMorph";
import { AgentHeroSection } from "./AgentHeroSection";
import { AgentAboutSection } from "./AgentAboutSection";
import { AgentReviewsSection } from "./AgentReviewsSection";
import { AgentTransactionsSection } from "./AgentTransactionsSection";
import type { AgentTransaction } from "./AgentTransactionsSection";

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
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  location: string | null;
  language: string | null;
  listingsClosed: number;
  volumeClosed: number;
  propertiesRented: number;
  transactions: AgentTransaction[];
};

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v.toLocaleString()}`;
}

export function AgentProfileHero({
  displayName,
  title,
  headshot,
  bio,
  licenseNum,
  licenseState,
  yearsExp,
  specialties,
  phone,
  email,
  instagram,
  facebook,
  location,
  language,
  listingsClosed,
  volumeClosed,
  propertiesRented,
  transactions,
}: AgentProfileHeroProps) {
  const name = displayName ?? "CnC Realty Agent";

  const stats = [
    {
      type: "years" as const,
      value: yearsExp !== null ? yearsExp.toString() : "—",
      label: "Years of Experience",
    },
    {
      type: "listings" as const,
      value: listingsClosed > 0 ? listingsClosed.toString() : "—",
      label: "Listings Closed",
    },
    {
      type: "volume" as const,
      value: volumeClosed > 0 ? formatVolume(volumeClosed) : "—",
      label: "Volume Closed",
    },
    {
      type: "rented" as const,
      value: propertiesRented > 0 ? propertiesRented.toString() : "—",
      label: "Properties Rented",
    },
  ];

  // ── Photo morph refs ──────────────────────────────────────────────────────
  const wrapperRef     = useRef<HTMLDivElement>(null);
  const [heroPhotoEl,  setHeroPhotoEl]  = useState<HTMLDivElement | null>(null);
  const [aboutPhotoEl, setAboutPhotoEl] = useState<HTMLDivElement | null>(null);

  const [startRect,    setStartRect]    = useState<MorphRect | null>(null);
  const [endRect,      setEndRect]      = useState<MorphRect | null>(null);
  const [endProgress,  setEndProgress]  = useState(0.5);
  const [morphReady,   setMorphReady]   = useState(false);
  const [morphComplete, setMorphComplete] = useState(false);
  const endProgressRef = useRef(0.5);

  // Stable ref callbacks so AgentHeroSection / AgentAboutSection don't re-render on every parent render
  const onHeroPhotoRef  = useCallback((el: HTMLDivElement | null) => setHeroPhotoEl(el),  []);
  const onAboutPhotoRef = useCallback((el: HTMLDivElement | null) => setAboutPhotoEl(el), []);

  // Measure positions once both elements are in the DOM
  useEffect(() => {
    if (!heroPhotoEl || !aboutPhotoEl || !wrapperRef.current) return;

    const measure = () => {
      const heroR    = heroPhotoEl.getBoundingClientRect();
      const aboutR   = aboutPhotoEl.getBoundingClientRect();
      const wrapperR = wrapperRef.current!.getBoundingClientRect();
      const sy  = window.scrollY;
      const vh  = window.innerHeight;

      // Convert viewport rects → document positions
      const heroDocTop   = heroR.top  + sy;
      const aboutDocTop  = aboutR.top + sy;
      const wrapperDocTop = wrapperR.top + sy;
      const totalScroll  = Math.max(1, wrapperR.height - vh);

      // scrollYProgress=0 when scrollY=wrapperDocTop → hero photo is at heroDocTop-wrapperDocTop
      const startY = heroDocTop - wrapperDocTop;
      const startX = heroR.left;

      const stickyOffset  = 112;
      const idealTarget   = aboutDocTop - stickyOffset;
      const p             = Math.max(0.05, Math.min(1.0, (idealTarget - wrapperDocTop) / totalScroll));

      // About photo's viewport y when animation ends
      const endY = aboutDocTop - wrapperDocTop - p * totalScroll;
      const endX = aboutR.left;

      setStartRect({ x: startX, y: startY, w: heroR.width,  h: heroR.height  });
      setEndRect  ({ x: endX,   y: endY,   w: aboutR.width, h: aboutR.height });
      endProgressRef.current = p;
      setEndProgress(p);
      setMorphReady(true);
    };

    const t = setTimeout(measure, 60);
    window.addEventListener("resize", measure, { passive: true });
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [heroPhotoEl, aboutPhotoEl]);

  // Drive scroll ─────────────────────────────────────────────────────────────
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end end"],
  });

  // When scroll passes endProgress: hide overlay, show sticky card photo
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    setMorphComplete(latest >= endProgressRef.current);
  });

  return (
    <>
      {/* Relative wrapper spans hero + about — gives the sticky morph its scroll track */}
      <div ref={wrapperRef} className="relative">
        {startRect && endRect && (
          <AgentPhotoMorph
            headshot={headshot}
            name={name}
            startRect={startRect}
            endRect={endRect}
            endProgress={endProgress}
            scrollYProgress={scrollYProgress}
            visible={!morphComplete}
          />
        )}

        <AgentHeroSection
          name={name}
          title={title}
          headshot={headshot}
          phone={phone}
          onPhotoRef={onHeroPhotoRef}
          photoHidden={morphReady}
        />

        <AgentAboutSection
          displayName={name}
          title={title}
          headshot={headshot}
          bio={bio}
          licenseNum={licenseNum}
          licenseState={licenseState}
          specialties={specialties}
          phone={phone}
          email={email}
          instagram={instagram}
          facebook={facebook}
          location={location}
          language={language}
          stats={stats}
          onPhotoRef={onAboutPhotoRef}
          photoVisible={morphComplete}
        />
      </div>

      <AgentReviewsSection displayName={name} />

      <AgentTransactionsSection
        transactions={transactions}
        displayName={name}
      />
    </>
  );
}
