import { ArrowRight, GraduationCap } from "lucide-react";
import Link from "next/link";
import { APP_URL } from "@/lib/urls";
import { HeroMockup } from "../molecules/hero-mockup";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="min-h-[calc(100vh-4rem)] flex flex-col py-12 lg:py-0">
      <div className="container flex-1 flex items-center">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full">
          {/* Left Column: Copy + CTA */}
          <div className="text-center lg:text-left">
            {/* Credibility badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <GraduationCap className="h-4 w-4" />
              <span>Du CP à la Terminale — 415 programmes Éduscol</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1] mb-6">
              L&apos;IA qui aide à{" "}
              <span className="bg-gradient-to-r from-primary to-violet bg-clip-text text-transparent">comprendre</span>,
              <br />
              pas à copier
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8">
              TomIA pose les bonnes questions pour que votre enfant trouve les réponses par lui-même et gagne en confiance et en autonomie.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link href={APP_URL}>
                <Button size="lg" className="group w-full sm:w-auto">
                  Commencer gratuitement
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Voir comment ça marche
                </Button>
              </Link>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              Sans carte bancaire · Sans engagement
            </p>
          </div>

          {/* Right Column: Visual Mockup */}
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}
