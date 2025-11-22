import { ChevronDown } from "lucide-react";
import { HeroMockup } from "../molecules/hero-mockup";

export function Hero() {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
      <div className="container relative z-10 px-4 mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left Column: Copy */}
          <div className="max-w-2xl mx-auto lg:mx-0 text-center lg:text-left">
            {/* Headline */}
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl xl:text-6xl mb-8 leading-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
              L&apos;IA qui aide à{" "}
              <span className="text-primary">comprendre</span>,
              <br className="hidden lg:block" />
              {" "}pas à copier
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              TomIA guide la réflexion de votre enfant au lieu de donner les réponses. Il comprend vraiment et gagne en autonomie.
            </p>
          </div>

          {/* Right Column: Visual Mockup */}
          <HeroMockup />
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronDown className="h-6 w-6 text-muted-foreground/50" />
      </div>
    </section>
  );
}
