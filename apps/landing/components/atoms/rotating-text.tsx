"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";

export function RotatingText({
  words,
  interval = 3000,
}: {
  words: string[];
  interval?: number;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, interval);
    return () => clearInterval(id);
  }, [words.length, interval]);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={words[index]}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="inline-block bg-gradient-to-r from-primary to-violet bg-clip-text text-transparent pb-1"
      >
        {words[index]}
      </motion.span>
    </AnimatePresence>
  );
}
