"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@repo/ui";
import { DRAW_SECONDS } from "@/lib/motion";

const VIEW_BOX = "0 0 200 80";
const PATH = "M100 4 C 170 2, 198 30, 190 50 C 180 76, 40 80, 12 56 C -6 36, 30 6, 110 8";
const POSITION = "-inset-x-3 -inset-y-2 w-[calc(100%+1.5rem)] h-[calc(100%+1rem)]";

export function Scribble({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <span className={cn("relative inline-block", className)}>
      {children}
      <svg
        aria-hidden="true"
        viewBox={VIEW_BOX}
        preserveAspectRatio="none"
        fill="none"
        className={cn("pointer-events-none absolute overflow-visible", POSITION)}
      >
        <motion.path
          data-reveal=""
          d={PATH}
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
