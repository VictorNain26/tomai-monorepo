import { Hero } from "@/components/sections/hero";
import { Stats } from "@/components/sections/stats";
import { ProblemSolution } from "@/components/sections/problem-solution";
import { Features } from "@/components/sections/features";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Pricing } from "@/components/sections/pricing";
import { FAQ } from "@/components/sections/faq";
import { CTA } from "@/components/sections/cta";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "TomIA donne-t-il les réponses à mon enfant ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Non, jamais. TomIA utilise la méthode socratique : il pose des questions pour guider votre enfant vers la solution. Contrairement aux IA génératives qui donnent les réponses, TomIA fait comprendre et mémoriser durablement.",
      },
    },
    {
      "@type": "Question",
      name: "Comment puis-je suivre les progrès de mon enfant ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Vous avez accès à un tableau de bord parental qui montre les matières travaillées, le temps passé, et les notions maîtrisées. Vous pouvez aussi définir des limites de temps d'utilisation quotidiennes et recevoir des résumés d'activité.",
      },
    },
    {
      "@type": "Question",
      name: "Les contenus sont-ils alignés sur les programmes scolaires ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Oui, TomIA est entraîné sur 415 programmes officiels Éduscol, du CP à la Terminale. Il couvre toutes les matières : Maths, Français, Histoire-Géo, SVT, Physique-Chimie, Anglais...",
      },
    },
    {
      "@type": "Question",
      name: "Mes données sont-elles en sécurité ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Absolument. Vos données sont hébergées en Europe, conformément au RGPD. Nous ne vendons jamais vos informations et n'affichons aucune publicité. La confidentialité de votre famille est notre priorité.",
      },
    },
    {
      "@type": "Question",
      name: "Puis-je annuler à tout moment ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Oui, l'abonnement est sans engagement. Vous pouvez annuler en un clic depuis votre espace parent, sans frais ni justification.",
      },
    },
    {
      "@type": "Question",
      name: "Sur quels appareils TomIA est-il disponible ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "TomIA est disponible en application mobile sur iOS et Android. Votre enfant peut travailler depuis son smartphone ou sa tablette, à la maison ou en déplacement.",
      },
    },
    {
      "@type": "Question",
      name: "TomIA est-il compatible avec Pronote ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Oui, TomIA peut se connecter à Pronote pour récupérer automatiquement l'emploi du temps, les devoirs et les notes de votre enfant. Cela permet à TomIA de personnaliser son accompagnement en fonction du programme réel de la classe.",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Hero />
      <Stats />
      <ProblemSolution />
      <HowItWorks />
      <Features />
      <Pricing />
      <FAQ />
      <CTA />
    </>
  );
}
