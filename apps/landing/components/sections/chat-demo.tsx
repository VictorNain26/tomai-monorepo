"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@repo/ui";
import { REVEAL_SECONDS } from "@/lib/motion";
import { MarginNote } from "../annotations/margin-note";

const MESSAGES = [
  { from: "student", text: "C'est quoi la réponse du 3b ? 3x + 5 = 20" },
  { from: "tom", text: "On la trouve ensemble. Si tu enlèves 5 des deux côtés, il te reste quoi ?" },
  { from: "student", text: "3x = 15" },
  { from: "tom", text: "Exactement. Et pour avoir x tout seul, tu fais quoi ?" },
] as const;

export function ChatDemo({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <figure aria-label="Exemple de conversation entre un élève et Tom" className={cn("relative", className)}>
      <ol className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        {MESSAGES.map((message, index) => (
          <motion.li
            key={index}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: REVEAL_SECONDS, delay: 0.4 + index * 0.6 }}
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
              message.from === "student"
                ? "ml-auto bg-secondary text-secondary-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            <span className="sr-only">{message.from === "student" ? "L'élève : " : "Tom : "}</span>
            {message.text}
          </motion.li>
        ))}
      </ol>
      <MarginNote className="mt-4 text-right lg:absolute lg:-right-6 lg:top-24 lg:mt-0 lg:w-36 lg:translate-x-full lg:text-left">
        Une question plutôt qu&apos;une réponse : la méthode socratique.
      </MarginNote>
    </figure>
  );
}
