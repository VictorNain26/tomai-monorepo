"use client";

import { MessageSquare, Lightbulb, GraduationCap } from "lucide-react";
import { motion } from "framer-motion";

const STEPS = [
  {
    number: "01",
    title: "Posez votre question",
    description: "Maths, Français, Histoire... Votre enfant pose sa question à Tom comme à un professeur.",
    icon: MessageSquare,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    number: "02",
    title: "Tom guide la réflexion",
    description: "Tom pose des questions simples pour aider votre enfant à avancer, sans jamais donner la réponse.",
    icon: Lightbulb,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  {
    number: "03",
    title: "La notion est comprise",
    description: "L'élève trouve la solution par lui-même. Il gagne en confiance et retient mieux la leçon.",
    icon: GraduationCap,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 lg:py-32 overflow-hidden">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
            Comment ça marche ?
          </h2>
          <p className="text-lg text-muted-foreground">
            Une méthode simple et efficace pour redonner confiance à votre enfant.
          </p>
        </div>

        <div className="relative grid md:grid-cols-3 gap-12">
          {/* Connecting Line (Desktop) */}
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-blue-500/0 via-blue-500/20 to-blue-500/0" />

          {STEPS.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2, duration: 0.5 }}
              className="relative flex flex-col items-center text-center"
            >
              <div className={`relative flex items-center justify-center w-24 h-24 rounded-3xl ${step.bg} ${step.color} mb-8 z-10 transition-transform hover:scale-110 duration-300`}>
                <step.icon className="h-10 w-10" />
                <span className="absolute -top-2 -right-2 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {step.number}
                </span>
              </div>

              <h3 className="text-xl font-bold text-foreground mb-4">
                {step.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
