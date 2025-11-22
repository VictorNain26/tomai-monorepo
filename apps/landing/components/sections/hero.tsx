import { ChevronDown } from "lucide-react";
import { HeroMockup } from "../molecules/hero-mockup";

export function Hero() {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center py-12 lg:py-16">
      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left Column: Copy */}
          <div className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1] mb-6 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
              L&apos;IA qui aide à{" "}
              <span className="text-primary">comprendre</span>,
              <br />
              pas à copier
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              TomIA guide la réflexion de votre enfant au lieu de donner les réponses. Il comprend vraiment et gagne en autonomie.
            </p>
          </div>

          {/* Right Column: Visual Mockup */}
          <HeroMockup />
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronDown className="h-6 w-6 text-muted-foreground/50" />
      </div>
    </section>
  );
}
