"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ShieldCheck, BookOpen, BrainCircuit } from "lucide-react";

const FAQS = [
  {
    question: "Tom donne-t-il les réponses à mon enfant ?",
    answer: "Non, jamais. Tom utilise la méthode socratique : il pose des questions pour guider votre enfant vers la solution. Contrairement à ChatGPT qui donne les réponses, Tom fait comprendre et mémoriser durablement.",
    icon: BrainCircuit,
  },
  {
    question: "Comment puis-je suivre les progrès de mon enfant ?",
    answer: "Vous avez accès à un tableau de bord parental qui montre les matières travaillées, le temps passé, et les notions maîtrisées. Vous pouvez aussi définir des limites de temps d'utilisation quotidiennes.",
    icon: null,
  },
  {
    question: "Les contenus sont-ils alignés sur les programmes scolaires ?",
    answer: "Oui, Tom est entraîné sur 415 programmes officiels Éduscol, du CP à la Terminale. Il couvre toutes les matières : Maths, Français, Histoire-Géo, SVT, Physique-Chimie, Anglais...",
    icon: BookOpen,
  },
  {
    question: "Mes données sont-elles en sécurité ?",
    answer: "Absolument. Vos données sont hébergées en Europe, conformément au RGPD. Nous ne vendons jamais vos informations et n'affichons aucune publicité. La confidentialité de votre famille est notre priorité.",
    icon: ShieldCheck,
  },
  {
    question: "Puis-je annuler à tout moment ?",
    answer: "Oui, l'abonnement est sans engagement. Vous pouvez annuler en un clic depuis votre espace parent, sans frais ni justification. Vous pouvez aussi commencer gratuitement sans carte bancaire.",
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
            Tout ce que les parents veulent savoir avant de commencer.
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
