import { Hero } from "@/components/sections/hero";
import { Stats } from "@/components/sections/stats";
import { ProblemSolution } from "@/components/sections/problem-solution";
import { Features } from "@/components/sections/features";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Pricing } from "@/components/sections/pricing";
import { FAQ } from "@/components/sections/faq";
import { FAQS } from "@/components/sections/faq-data";
import { CTA } from "@/components/sections/cta";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
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
