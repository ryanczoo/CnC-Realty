"use client";

import Image from "next/image";
import { motion, useTransform, MotionValue } from "motion/react";

export type MorphRect = { x: number; y: number; w: number; h: number };

type Props = {
  headshot: string | null;
  name: string;
  startRect: MorphRect;
  endRect: MorphRect;
  endProgress: number;
  scrollYProgress: MotionValue<number>;
  visible?: boolean;
};

export function AgentPhotoMorph({
  headshot,
  name,
  startRect,
  endRect,
  endProgress,
  scrollYProgress,
  visible = true,
}: Props) {
  const x            = useTransform(scrollYProgress, [0, endProgress], [startRect.x, endRect.x]);
  const y            = useTransform(scrollYProgress, [0, endProgress], [startRect.y, endRect.y]);
  const width        = useTransform(scrollYProgress, [0, endProgress], [startRect.w, endRect.w]);
  const height       = useTransform(scrollYProgress, [0, endProgress], [startRect.h, endRect.h]);
  const borderRadius = useTransform(scrollYProgress, [0, endProgress], ["50%", "1rem"]);

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        height: 0,
        overflow: "visible",
        zIndex: 50,
        pointerEvents: "none",
        visibility: visible ? "visible" : "hidden",
      }}
    >
      <motion.div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          x,
          y,
          width,
          height,
          borderRadius,
          overflow: "hidden",
          backgroundColor: "#E0DDD8",
        }}
      >
        {headshot ? (
          <Image
            src={headshot}
            alt={name}
            fill
            sizes="(max-width: 768px) 96px, 40vw"
            quality={95}
            className="object-cover object-top"
            priority
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-sans text-xl font-light text-[#1B1B1B]/30">
            {name[0]?.toUpperCase()}
          </span>
        )}
      </motion.div>
    </div>
  );
}
