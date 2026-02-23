"use client";

import { MessageSquare, Lightbulb, GraduationCap } from "lucide-react";
import { motion } from "framer-motion";
import { SectionHeader } from "../atoms/section-header";
import { WaitlistForm } from "../molecules/waitlist-form";

const STEPS = [
  {
    number: "01",
    title: "Posez votre question",
    description: "Maths, Français, Histoire... Votre enfant pose sa question à TomIA comme à un professeur.",
    icon: MessageSquare,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    number: "02",
    title: "TomIA guide la réflexion",
    description: "TomIA pose des questions simples pour aider votre enfant à avancer, sans jamais donner la réponse.",
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
        <SectionHeader
          title="Comment ça marche ?"
          description="Une méthode simple et efficace pour redonner confiance à votre enfant."
        />

        <div className="relative grid md:grid-cols-3 gap-12">
          {/* Animated Connecting Line (Desktop) */}
          <motion.div
            className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-blue-500/30 via-yellow-500/30 to-green-500/30 origin-left"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />

          {STEPS.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
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

        <div className="flex justify-center mt-16">
          <WaitlistForm
            source="how-it-works"
            buttonText="Être notifié du lancement"
            className="max-w-lg w-full"
          />
        </div>
      </div>
    </section>
  );
}
