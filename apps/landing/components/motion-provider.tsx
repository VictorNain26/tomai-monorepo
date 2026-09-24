"use client";

import { useEffect } from "react";
import { MotionConfig } from "motion/react";

export function MotionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Effects run children first, so this marks the whole page as hydrated: the tests wait on it.
    document.documentElement.dataset.hydrated = "";
  }, []);

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
