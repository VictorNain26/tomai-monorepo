"use client";

import {
  BrainCircuit,
  LineChart,
  BookOpen,
  Sparkles,
  Clock
} from "lucide-react";
import { motion } from "framer-motion";
import { SectionHeader } from "../atoms/section-header";

const FEATURES = [
  {
    title: "Apprendre en réfléchissant",
    description: "Votre enfant construit sa compréhension au lieu de copier des réponses.",
    icon: BrainCircuit,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    title: "Chaque enfant avance à son rythme",
    description: "TomIA détecte les lacunes et adapte ses explications en temps réel.",
    icon: LineChart,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    title: "Aligné sur les programmes Éduscol",
    description: "Du CP à la Terminale, TomIA suit les programmes officiels du Ministère de l'Éducation nationale.",
    icon: BookOpen,
    color: "text-violet",
    bg: "bg-violet/10",
  },
  {
    title: "Votre enfant reste motivé",
    description: "Fiches auto-générées et répétition espacée pour ancrer durablement.",
    icon: Sparkles,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  {
    title: "Disponible quand vous en avez besoin",
    description: "Le soir, le week-end, en vacances — sur iOS et Android, partout et à tout moment.",
    icon: Clock,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function Features() {
  return (
    <section id="features" className="py-24 lg:py-32 bg-secondary/30">
      <div className="container px-4 mx-auto">
        <SectionHeader
          title="Tout ce qu'il faut pour réussir"
          description="Une plateforme complète conçue pour l'autonomie et la réussite scolaire de votre enfant."
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {FEATURES.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="group relative overflow-hidden rounded-2xl bg-card border border-border p-8 transition-all duration-300 hover:shadow-xl hover:border-transparent"
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
