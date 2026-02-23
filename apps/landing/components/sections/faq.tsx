"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, BrainCircuit, BarChart3, BookOpen, ShieldCheck, CreditCard, GraduationCap, MessageSquareX } from "lucide-react";
import Link from "next/link";
import { SectionHeader } from "../atoms/section-header";

const FAQS = [
  {
    question: "TomIA donne-t-il les réponses à mon enfant ?",
    answer: "Non, jamais. TomIA utilise la méthode socratique : il pose des questions pour guider votre enfant vers la solution. Votre enfant comprend et retient, au lieu de copier et oublier.",
    icon: BrainCircuit,
  },
  {
    question: "Quelle différence avec ChatGPT ou Photomath ?",
    answer: "ChatGPT et Photomath donnent les réponses — votre enfant oublie demain. TomIA pose les bonnes questions pour faire comprendre durablement. En plus, TomIA connaît les programmes officiels, se connecte à Pronote, et vous donne un tableau de bord parental. C'est un tuteur, pas un moteur de réponses.",
    icon: MessageSquareX,
  },
  {
    question: "TomIA est-il compatible avec Pronote ?",
    answer: "Oui, TomIA se connecte à Pronote pour voir l'emploi du temps réel, les devoirs du jour et les chapitres en cours. L'accompagnement est personnalisé au programme exact de la classe de votre enfant.",
    icon: GraduationCap,
  },
  {
    question: "Comment puis-je suivre les progrès de mon enfant ?",
    answer: "Vous avez accès à un tableau de bord parental qui montre les matières travaillées, le temps passé, les notions maîtrisées et les lacunes détectées. Vous pouvez aussi définir des limites de temps d'utilisation quotidiennes.",
    icon: BarChart3,
  },
  {
    question: "Les contenus sont-ils alignés sur les programmes scolaires ?",
    answer: "Oui, TomIA est entraîné sur les programmes officiels Éduscol, du CP à la Terminale. Il couvre toutes les matières : Maths, Français, Histoire-Géo, SVT, Physique-Chimie, Anglais, Philosophie…",
    icon: BookOpen,
  },
  {
    question: "Mes données sont-elles en sécurité ?",
    answer: "Absolument. Vos données sont hébergées en France, conformément au RGPD. Nous ne vendons jamais vos informations et n'affichons aucune publicité. La confidentialité de votre famille est notre priorité.",
    icon: ShieldCheck,
  },
  {
    question: "Puis-je annuler à tout moment ?",
    answer: "Oui, l'abonnement est sans engagement. Vous pouvez annuler en un clic depuis votre espace parent, sans frais ni justification. L'offre gratuite (5 questions/jour) reste accessible sans limite de durée.",
    icon: CreditCard,
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 bg-secondary/50">
      <div className="container px-4 mx-auto">
        <SectionHeader
          title="Questions fréquentes"
          description="Tout ce que les parents veulent savoir avant de commencer."
        />

        <div className="space-y-4 max-w-3xl mx-auto">
          {FAQS.map((faq, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200 hover:border-primary/50"
            >
              <button
                type="button"
                id={`faq-question-${index}`}
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${index}`}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <div className="flex items-center gap-4">
                  {faq.icon && (
                    <div className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full shrink-0 ${openIndex === index ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'} transition-colors`}>
                      <faq.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                  )}
                  <span className="font-semibold text-base sm:text-lg text-foreground">
                    {faq.question}
                  </span>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform duration-200 shrink-0 ml-2 ${openIndex === index ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    id={`faq-answer-${index}`}
                    role="region"
                    aria-labelledby={`faq-question-${index}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-6 pb-6 pl-[3.25rem] sm:pl-20 text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Vous avez une autre question ?{" "}
          <Link href="/contact" className="text-primary hover:underline font-medium">
            Contactez-nous
          </Link>
        </p>
      </div>
    </section>
  );
}
