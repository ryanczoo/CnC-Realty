"use client";

import { useEffect, useRef, useState } from "react";
import { applyChromaKeyAlpha } from "@/lib/chroma-key-alpha";
import { MOBILE_QUERY } from "@/hooks/useIsMobile";

// Matches the source video's native resolution deliberately -- downscaling
// here would blend each confetti piece's edge pixels with the surrounding
// green *before* the chroma-key math runs, since pieces are only a few
// pixels wide at source res. That blend produces muddy olive pixels far
// enough from pure green to read as "opaque," tinting confetti green.
// Keying at native resolution keeps the math looking at true colors.
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

// Phones key at half resolution: 4x fewer pixels per frame keeps playback
// smooth on slower phone processors. Trade-off accepted for phones only: the
// smallest confetti pieces blend slightly with the green before keying (see
// above). Desktop keeps the native resolution.
export function confettiCanvasSize(isMobile: boolean): { width: number; height: number } {
  return isMobile ? { width: CANVAS_WIDTH / 2, height: CANVAS_HEIGHT / 2 } : { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
}

export function ConfettiCannonInner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(false);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Read the media query directly: the canvas is sized once at mount, and
    // useIsMobile() is still false during hydration.
    const { width, height } = confettiCanvasSize(window.matchMedia(MOBILE_QUERY).matches);
    canvas.width = width;
    canvas.height = height;

    let rafId: number;

    const drawFrame = () => {
      ctx.drawImage(video, 0, 0, width, height);
      const frame = ctx.getImageData(0, 0, width, height);
      applyChromaKeyAlpha(frame.data);
      ctx.putImageData(frame, 0, 0);
      rafId = requestAnimationFrame(drawFrame);
    };

    video.addEventListener("playing", drawFrame);
    video.play().catch(() => {});

    return () => {
      video.removeEventListener("playing", drawFrame);
      cancelAnimationFrame(rafId);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        src="/videos/join-confetti-greenscreen-444.mp4"
        muted
        playsInline
        preload="none"
        onEnded={() => setVisible(false)}
        onError={() => setVisible(false)}
        className="absolute h-px w-px opacity-0"
      />
      <canvas ref={canvasRef} style={{ width: "100%", height: "auto" }} />
    </div>
  );
}
