"use client";

import { BookOpen, GraduationCap, Clock, CreditCard } from "lucide-react";
import { AnimatedCounter } from "../atoms/animated-counter";
import { FadeIn } from "../atoms/fade-in";

const STATS = [
  {
    value: 10,
    label: "matières couvertes",
    icon: BookOpen,
  },
  {
    value: 4,
    label: "niveaux du collège",
    icon: GraduationCap,
  },
  {
    value: 24,
    suffix: "/7",
    label: "disponibilité",
    icon: Clock,
  },
  {
    value: 0,
    suffix: "€",
    label: "pour commencer",
    icon: CreditCard,
  },
];

export function Stats() {
  return (
    <section className="py-16 sm:py-20 border-y border-border/40">
      <div className="container px-4 mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat, index) => (
            <FadeIn key={stat.label} delay={index * 0.1} direction="up">
              <div className="flex flex-col items-center text-center gap-2">
                <stat.icon className="h-6 w-6 text-primary mb-1" />
                <p className="text-3xl sm:text-4xl font-bold text-foreground">
                  <AnimatedCounter
                    value={stat.value}
                    suffix={stat.suffix}
                  />
                </p>
                <p className="text-sm text-muted-foreground font-medium">
                  {stat.label}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
