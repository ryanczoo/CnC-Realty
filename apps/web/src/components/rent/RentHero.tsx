"use client";

import { VideoMaskHero } from "@/components/ui/VideoMaskHero";

export function RentHero() {
  return <VideoMaskHero maskId="rent-hero-mask" videoSrc="/videos/rent-hero.mp4" lines={["RENT", "WITH US"]} />;
}
