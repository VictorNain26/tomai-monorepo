import { Hero } from "@/components/sections/hero";
import { ProblemSolution } from "@/components/sections/problem-solution";
import { Features } from "@/components/sections/features";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Pricing } from "@/components/sections/pricing";
import { FAQ } from "@/components/sections/faq";
import { CTA } from "@/components/sections/cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <div className="flex flex-col">
        <ProblemSolution />
        <HowItWorks />
        <Features />
        <Pricing />
        <FAQ />
        <CTA />
      </div>
    </>
  );
}
