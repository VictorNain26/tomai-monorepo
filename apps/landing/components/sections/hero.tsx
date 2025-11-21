import Link from "next/link";
import { ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_URL } from "@/lib/urls";
import { HeroBadge } from "../atoms/hero-badge";
import { HeroMockup } from "../molecules/hero-mockup";

export function Hero() {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center pt-12 pb-16 md:pt-0 md:pb-0 overflow-hidden">
      {/* Background Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-72 h-72 bg-primary/20 rounded-full blur-[100px] opacity-50 animate-pulse" />
        <div className="absolute top-[30%] right-[10%] w-96 h-96 bg-blue-400/10 rounded-full blur-[120px] opacity-30" />
      </div>

      <div className="container relative z-10 px-4 mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left Column: Copy */}
          <div className="max-w-2xl mx-auto lg:mx-0 text-center lg:text-left">
            {/* Badge */}
            <HeroBadge />

            {/* Headline */}
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl xl:text-5xl mb-6 leading-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
              L&apos;assistant qui <br className="hidden sm:block" />
              <span className="text-primary">
                apprend à réfléchir
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-base text-muted-foreground mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              Un tuteur IA qui guide l'élève vers la solution sans donner la réponse directement. <br className="hidden sm:block" />
              <span className="font-medium text-foreground">Une pédagogie active pour une compréhension durable.</span>
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
              <Link href={APP_URL} className="w-full sm:w-auto">
                <Button size="xl" className="w-full sm:w-auto min-w-[200px] shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                  Commencer gratuitement
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="#how-it-works" className="w-full sm:w-auto">
                <Button variant="outline" size="xl" className="w-full sm:w-auto min-w-[200px] bg-background/50 backdrop-blur-sm hover:bg-secondary/50">
                  Découvrir la méthode
                </Button>
              </Link>
            </div>

            {/* Trust Signals */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-8 gap-y-4 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-12 duration-700 delay-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <span>Données sécurisées en France</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Programme Éducation Nationale</span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Mockup */}
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}
