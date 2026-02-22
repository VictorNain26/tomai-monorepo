"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ShieldCheck, BookOpen, BrainCircuit, BarChart3, CreditCard, Smartphone, GraduationCap, Languages, Gauge, Users } from "lucide-react";
import { SectionHeader } from "../atoms/section-header";

const FAQS = [
  {
    question: "TomIA donne-t-il les réponses à mon enfant ?",
    answer: "Non, jamais. TomIA utilise la méthode socratique : il pose des questions pour guider votre enfant vers la solution. Contrairement aux IA génératives qui donnent les réponses, TomIA fait comprendre et mémoriser durablement.",
    icon: BrainCircuit,
  },
  {
    question: "Comment puis-je suivre les progrès de mon enfant ?",
    answer: "Vous avez accès à un tableau de bord parental qui montre les matières travaillées, le temps passé, et les notions maîtrisées. Vous pouvez aussi définir des limites de temps d'utilisation quotidiennes.",
    icon: BarChart3,
  },
  {
    question: "Les contenus sont-ils alignés sur les programmes scolaires ?",
    answer: "Oui, TomIA est entraîné sur 415 programmes officiels Éduscol, du CP à la Terminale. Il couvre toutes les matières : Maths, Français, Histoire-Géo, SVT, Physique-Chimie, Anglais...",
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
    icon: CreditCard,
  },
  {
    question: "Sur quels appareils TomIA est-il disponible ?",
    answer: "TomIA est disponible sur le web (ordinateur, tablette) et en application mobile sur iOS et Android. Votre enfant peut travailler depuis n'importe quel appareil, à la maison ou en déplacement.",
    icon: Smartphone,
  },
  {
    question: "TomIA est-il compatible avec Pronote ?",
    answer: "Oui, TomIA peut se connecter à Pronote pour récupérer automatiquement l'emploi du temps, les devoirs et les notes de votre enfant. Cela permet à TomIA de personnaliser son accompagnement en fonction du programme réel de la classe.",
    icon: GraduationCap,
  },
  {
    question: "TomIA est-il disponible en d'autres langues ?",
    answer: "Actuellement, TomIA est disponible uniquement en français, car il est spécialement conçu pour les programmes scolaires français (Éduscol). D'autres langues pourront être envisagées à l'avenir.",
    icon: Languages,
  },
  {
    question: "Y a-t-il une limite d'utilisation quotidienne ?",
    answer: "L'offre gratuite inclut 5 questions par jour, suffisant pour une session de devoirs. L'offre Complet propose des questions illimitées. Les parents peuvent également définir leurs propres limites de temps.",
    icon: Gauge,
  },
  {
    question: "Comment fonctionne le suivi pour les parents ?",
    answer: "Les parents disposent d'un espace dédié avec un tableau de bord complet : matières travaillées, temps passé, notions maîtrisées et axes de progression. Vous pouvez aussi paramétrer des limites d'utilisation et recevoir des résumés d'activité.",
    icon: Users,
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24">
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
                    id={`faq-answer-${index}`}
                    role="region"
                    aria-labelledby={`faq-question-${index}`}
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
