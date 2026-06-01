"use client";
import { useRef } from "react";
import { useInView } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE_OUT_EXPO } from "@/lib/motion";

const EASE_CSS = `cubic-bezier(${EASE_OUT_EXPO.join(",")})`;

interface RevealTextProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  onDark?: boolean;
  color?: string;
}

// Use RevealLine for headings with mixed colors (dark text + gold accent).
// clipPath inset() is used instead of mask so the animation is reliable across browsers,
// and negative inset values extend the clip region past the border box to capture descenders.
export function RevealLine({ children, delay = 0, className }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-8%" });

  return (
    <span ref={ref} className={cn("relative inline-block", className)} style={{ color: "#1B1B1B" }}>
      {/* Dim base — always visible, sets layout dimensions */}
      <span aria-hidden style={{ opacity: 0.18 }}>{children}</span>
      {/* Bright overlay — revealed left-to-right via clip-path */}
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: "-0.25em",
          // negative top/bottom captures ascenders + descenders; negative left prevents left-edge clipping
          clipPath: isInView ? "inset(-10% 0% -10% -5%)" : "inset(-10% 100% -10% -5%)",
          transition: `clip-path 1.2s ${EASE_CSS} ${delay}s`,
        } as React.CSSProperties}
      >
        {children}
      </span>
    </span>
  );
}

export function RevealText({ children, className, delay = 0, onDark = false, color: colorProp }: RevealTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-8%" });

  const color = colorProp ?? (onDark ? "#ffffff" : "#1B1B1B");
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
        transitionTimingFunction: `cubic-bezier(${EASE_OUT_EXPO.join(",")})`,
      }}
    >
      {children}
    </span>
  );
}
