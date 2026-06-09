"use client";

import { VideoMaskHero } from "@/components/ui/VideoMaskHero";

export function SellHero() {
  return <VideoMaskHero maskId="sell-hero-mask" videoSrc="/videos/sell-hero.mp4" lines={["SELL", "WITH US"]} />;
}
