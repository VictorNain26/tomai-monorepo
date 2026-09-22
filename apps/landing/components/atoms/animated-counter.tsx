"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";

export function AnimatedCounter({
  value,
  suffix = "",
  prefix = "",
  duration = 1500,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [display, setDisplay] = useState(value === 0 ? 0 : 0);

  useEffect(() => {
    if (!isInView || value === 0) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = prefersReduced ? 1 : Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, [isInView, value, duration]);

  return (
    <span ref={ref}>
      {prefix}{display}{suffix}
    </span>
  );
}
