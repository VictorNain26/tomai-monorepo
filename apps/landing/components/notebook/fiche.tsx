"use client";

import { motion, type Variants } from "motion/react";
import { cn } from "@repo/ui";

const TILTS = {
  none: "",
  left: "-rotate-[0.6deg]",
  right: "rotate-[0.8deg]",
} as const;

const PASTE: Variants = {
  hidden: { opacity: 0, y: -12, rotate: -2.5, scale: 1.03 },
  shown: { opacity: 1, y: 0, rotate: 0, scale: 1 },
};

interface FicheProps {
  tilt?: keyof typeof TILTS;
  variant?: "paper" | "note";
  delay?: number;
  className?: string;
  children: React.ReactNode;
}

export function Fiche({ tilt = "left", variant = "paper", delay = 0, className, children }: FicheProps) {
  return (
    <motion.div
      data-fiche=""
      data-reveal=""
      variants={PASTE}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.65, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        "relative p-4 shadow-md sm:p-6 md:p-8",
        variant === "paper" ? "fiche-tape bg-card text-card-foreground" : "bg-note text-note-foreground",
        TILTS[tilt],
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
