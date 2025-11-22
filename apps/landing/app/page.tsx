import { Hero } from "@/components/sections/hero";
import { ProblemSolution } from "@/components/sections/problem-solution";
import { Features } from "@/components/sections/features";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Pricing } from "@/components/sections/pricing";

export default function HomePage() {
  return (
    <>
      <Hero />
      <div className="flex flex-col gap-16 sm:gap-20 lg:gap-24 pb-16">
        <ProblemSolution />
        <HowItWorks />
        <Features />
        <Pricing />
      </div>
    </>
  );
}
