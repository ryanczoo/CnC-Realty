"use client";

import { VideoMaskHero } from "@/components/ui/VideoMaskHero";

export function BuyHero() {
  return <VideoMaskHero maskId="buy-hero-mask" videoSrc="/videos/buy-hero.mp4" lines={["BUY", "WITH US"]} />;
}
