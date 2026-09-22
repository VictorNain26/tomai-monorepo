"use client";

import {
  BrainCircuit,
  LineChart,
  BookOpen,
  Plug,
  RefreshCcw,
} from "lucide-react";
import { motion } from "motion/react";
import { SectionHeader } from "../atoms/section-header";

const FEATURES = [
  {
    title: "Apprendre en réfléchissant",
    description:
      "TomIA ne donne jamais la réponse. Il pose les bonnes questions pour que votre enfant comprenne par lui-même — méthode socratique.",
    icon: BrainCircuit,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    title: "Un tuteur qui connaît votre enfant",
    description:
      "TomIA détecte les lacunes, ajuste la difficulté et revient sur les notions mal comprises. Plus votre enfant l'utilise, plus il est efficace.",
    icon: LineChart,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    title: "Connecté à Pronote",
    description:
      "TomIA voit l'emploi du temps du jour, les devoirs de la semaine et les dernières notes. L'aide part de ce que votre enfant a réellement à faire.",
    icon: Plug,
    color: "text-violet",
    bg: "bg-violet/10",
  },
  {
    title: "Adapté à chaque niveau",
    description:
      "De la 6e à la 3e, 10 matières : Maths, Français, Histoire-Géo, SVT, Physique-Chimie, Technologie, Anglais, Espagnol, Allemand et Italien. Les explications suivent la classe de votre enfant.",
    icon: BookOpen,
    color: "text-violet",
    bg: "bg-violet/10",
  },
  {
    title: "Mémoriser durablement",
    description:
      "TomIA génère des fiches de révision à partir de ce que votre enfant a trouvé difficile. Rappels espacés pour ne plus oublier.",
    icon: RefreshCcw,
    color: "text-primary",
    bg: "bg-primary/10",
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
    <section id="features" className="py-24 lg:py-32 bg-secondary/50">
      <div className="container px-4 mx-auto">
        <SectionHeader
          title="Tout ce qu'il faut pour réussir"
          description="Un service web complet conçu pour l'autonomie et la réussite scolaire de votre enfant."
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
              className="group relative overflow-hidden rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 ring-1 ring-border/20 shadow-md p-8 transition-all duration-300 hover:shadow-xl hover:border-transparent"
            >
              {/* Gradient Border on Hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 via-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              <div className="relative z-10">
                <div
                  className={`inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br ${feature.bg} ${feature.color} mb-6 transition-all group-hover:scale-110 group-hover:rotate-3 duration-300`}
                >
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
