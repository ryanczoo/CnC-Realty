"use client";
import { useRef } from "react";
import { useInView } from "motion/react";
import { cn } from "@/lib/utils";

interface RevealTextProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  onDark?: boolean;
}

export function RevealText({ children, className, delay = 0, onDark = false }: RevealTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-8%" });

  const color = onDark ? "#ffffff" : "#1B1B1B";
  const dimColor = onDark ? "rgba(255,255,255,0.18)" : "rgba(27,27,27,0.18)";

  return (
    <span
      ref={ref}
      className={cn("inline-block", className)}
      style={{
        background: `linear-gradient(to right, ${color} 50%, ${dimColor} 50%)`,
        backgroundSize: "200% 100%",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        color: "transparent",
        backgroundPosition: isInView ? "0% 0%" : "100% 0%",
        transitionProperty: "background-position",
        transitionDuration: "1.2s",
        transitionDelay: `${delay}s`,
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {children}
    </span>
  );
}
