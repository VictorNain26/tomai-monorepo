"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ShieldCheck, BookOpen, BrainCircuit } from "lucide-react";

const FAQS = [
  {
    question: "Est-ce que TomIA donne les réponses aux exercices ?",
    answer: "Non, et c'est tout l'intérêt ! TomIA guide par des questions. Au lieu de donner la réponse, il aide votre enfant à la trouver par lui-même. C'est comme avoir un professeur particulier qui explique, plutôt qu'un camarade qui laisse copier.",
    icon: BrainCircuit,
  },
  {
    question: "Quelles matières sont couvertes ?",
    answer: "TomIA couvre l'intégralité du programme officiel de l'Éducation Nationale, du CP à la Terminale. Cela inclut les Mathématiques, le Français, l'Histoire-Géo, les SVT, la Physique-Chimie, la Philosophie, et les langues vivantes.",
    icon: BookOpen,
  },
  {
    question: "Mes données sont-elles en sécurité ?",
    answer: "Absolument. TomIA est une solution française. Toutes les données sont hébergées en Europe sur des serveurs sécurisés et certifiés. Nous ne vendons aucune donnée et il n'y a aucune publicité sur la plateforme.",
    icon: ShieldCheck,
  },
  {
    question: "Peut-on l'utiliser sur téléphone ?",
    answer: "Oui, TomIA est accessible depuis n'importe quel appareil : ordinateur, tablette ou smartphone. L'interface s'adapte parfaitement pour une utilisation mobile.",
    icon: null,
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
            Questions fréquentes
          </h2>
          <p className="text-lg text-muted-foreground">
            Tout ce que vous devez savoir sur TomIA.
          </p>
        </div>

        <div className="space-y-4 max-w-3xl mx-auto">
          {FAQS.map((faq, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200 hover:border-primary/50"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <div className="flex items-center gap-4">
                  {faq.icon && (
                    <div className={`hidden sm:flex h-10 w-10 items-center justify-center rounded-full ${openIndex === index ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'} transition-colors`}>
                      <faq.icon className="h-5 w-5" />
                    </div>
                  )}
                  <span className="font-semibold text-lg text-foreground">
                    {faq.question}
                  </span>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${openIndex === index ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-6 pb-6 pl-6 sm:pl-20 text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
