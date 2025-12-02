"use client";

import {
  BrainCircuit,
  LineChart,
  BookOpen,
  ShieldCheck,
  Gamepad2,
  Clock
} from "lucide-react";
import { motion } from "framer-motion";

const FEATURES = [
  {
    title: "Apprendre en réfléchissant",
    description: "Tom pose des questions pour guider votre enfant vers la solution. Il comprend vraiment et s'en souvient.",
    icon: BrainCircuit,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    colSpan: "lg:col-span-2",
  },
  {
    title: "S'adapte à son niveau",
    description: "L'assistant s'adapte au niveau de votre enfant et propose des exercices adaptés là où il en a besoin.",
    icon: LineChart,
    color: "text-green-500",
    bg: "bg-green-500/10",
    colSpan: "lg:col-span-1",
  },
  {
    title: "100% Programme Officiel",
    description: "Couvre toutes les matières du CP à la Terminale : Maths, Français, Histoire-Géo, SVT, Physique-Chimie...",
    icon: BookOpen,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    colSpan: "lg:col-span-1",
  },
  {
    title: "Confidentialité Garantie",
    description: "Vos données restent en Europe et ne sont jamais partagées. Aucune publicité, aucune revente.",
    icon: ShieldCheck,
    color: "text-red-500",
    bg: "bg-red-500/10",
    colSpan: "lg:col-span-2",
  },
  {
    title: "Apprentissage Ludique",
    description: "Système de points et de badges pour motiver l'élève à réviser régulièrement.",
    icon: Gamepad2,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    colSpan: "lg:col-span-1",
  },
  {
    title: "Disponible 24/7",
    description: "Une aide aux devoirs accessible à tout moment, pour ne jamais rester bloqué sur un exercice.",
    icon: Clock,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    colSpan: "lg:col-span-2",
  },
];



import { SectionHeader } from "../atoms/section-header";

export function Features() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <section id="features" className="py-24 lg:py-32 bg-secondary/30">
      <div className="container px-4 mx-auto">
        <SectionHeader
          title="Tout ce qu'il faut pour réussir"
          description="Une plateforme complète conçue pour l'autonomie et la réussite scolaire de votre enfant."
        />

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {FEATURES.map((feature, index) => (
            <motion.div
              key={index}
              variants={item}
              className={`group relative overflow-hidden rounded-2xl bg-card border border-border p-8 transition-all duration-300 hover:shadow-xl hover:border-transparent ${feature.colSpan}`}
            >
              {/* Gradient Border on Hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 via-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              <div className="relative z-10">
                <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br ${feature.bg} ${feature.color} mb-6 transition-all group-hover:scale-110 group-hover:rotate-3 duration-300`}>
                  <feature.icon className="h-6 w-6" />
                </div>

                <h3 className="text-xl font-bold text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
