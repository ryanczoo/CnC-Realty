"use client";

import { VideoMaskHero } from "@/components/ui/VideoMaskHero";

export function PressHero() {
  return (
    <VideoMaskHero
      maskId="press-hero-mask"
      videoSrc="/videos/news-hero.mp4"
      lines={["PRESS"]}
      heightClass="h-[47.5vh]"
      playbackRate={0.5}
      overlayOpacity={0.35}
      videoPosition="object-[center_25%]"
    />
  );
}
