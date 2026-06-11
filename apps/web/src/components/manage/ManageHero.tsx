"use client";

import { VideoMaskHero } from "@/components/ui/VideoMaskHero";

export function ManageHero() {
  return <VideoMaskHero maskId="manage-hero-mask" videoSrc="/videos/manage-hero.mp4" lines={["MANAGE", "WITH US"]} />;
}
