"use client";

import { motion, useReducedMotion } from "motion/react";
import { GraduationCap, Landmark, ShieldCheck } from "lucide-react";
import { DRAW_SECONDS, REVEAL_SECONDS } from "@/lib/motion";
import { Scribble } from "../annotations/scribble";
import { WaitlistForm } from "../molecules/waitlist-form";
import { ChatDemo } from "./chat-demo";

const SIGNALS = [
  { icon: GraduationCap, label: "Collège, de la 6e à la 3e" },
  { icon: Landmark, label: "Hébergé dans l'Union européenne" },
  { icon: ShieldCheck, label: "Gratuit pour commencer" },
];

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="flex min-h-[calc(100svh-4rem)] items-start py-16 lg:py-24">
      <div className="container grid w-full grid-cols-1 items-start gap-16 lg:grid-cols-2">
        <div>
          <h1 className="text-4xl font-semibold text-balance text-foreground sm:text-6xl xl:text-7xl">
            Il ne donne pas la réponse. Il aide à la{" "}
            <Scribble kind="strike" delay={0.3}>
              <span aria-hidden="true" className="text-muted-foreground">trouver</span>
            </Scribble>{" "}
            <motion.em
              data-reveal=""
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: REVEAL_SECONDS, delay: 0.3 + DRAW_SECONDS }}
              className="text-annotation"
            >
              comprendre
            </motion.em>
            .
          </h1>

          <p className="mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">
            Tom accompagne votre enfant dans ses devoirs comme un bon professeur : par des questions,
            à son niveau, jusqu&apos;à ce qu&apos;il trouve seul.
          </p>

          <WaitlistForm source="hero" className="mt-10 max-w-lg" />

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {SIGNALS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="size-4 text-success" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <ChatDemo className="mx-auto w-full max-w-md lg:mr-24" />
      </div>
    </section>
  );
}
