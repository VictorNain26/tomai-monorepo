"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@repo/ui";
import { DRAW_SECONDS } from "@/lib/motion";

const SHAPES = {
  underline: {
    viewBox: "0 0 200 12",
    d: "M2 8 C 50 2, 120 12, 198 5",
    position: "-bottom-2 left-0 h-3 w-full",
  },
  strike: {
    viewBox: "0 0 200 20",
    d: "M2 12 C 60 6, 140 16, 198 8",
    position: "left-0 top-1/2 h-5 w-full -translate-y-1/2",
  },
  circle: {
    viewBox: "0 0 200 80",
    d: "M100 4 C 170 2, 198 30, 190 50 C 180 76, 40 80, 12 56 C -6 36, 30 6, 110 8",
    position: "-inset-x-3 -inset-y-2",
  },
} as const;

export type ScribbleKind = keyof typeof SHAPES;

export function Scribble({
  kind,
  delay = 0,
  className,
  children,
}: {
  kind: ScribbleKind;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const shape = SHAPES[kind];

  return (
    <span className={cn("relative inline-block", className)}>
      {children}
      <svg
        aria-hidden="true"
        viewBox={shape.viewBox}
        preserveAspectRatio="none"
        fill="none"
        className={cn("pointer-events-none absolute overflow-visible text-primary", shape.position)}
      >
        <motion.path
          d={shape.d}
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={reduceMotion ? false : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: DRAW_SECONDS, delay, ease: "easeInOut" }}
        />
      </svg>
    </span>
  );
}
