import Link from "next/link";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-secondary/20 py-16 sm:py-24 lg:py-32">
      <div className="container relative">
        <div className="mx-auto max-w-5xl">
          {/* Badge */}
          <div className="mb-6 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground">Assistant pédagogique IA pour étudiants français</span>
            </div>
          </div>

          {/* Headline - Bénéfice clair et mesurable */}
          <h1 className="mb-6 text-center text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-7xl">
            Aidez votre enfant à{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              comprendre
            </span>
            {" "}plutôt que mémoriser
          </h1>

          {/* Subheadline - Proposition de valeur concrète */}
          <p className="mb-10 text-center text-base text-muted-foreground sm:text-lg lg:text-xl max-w-3xl mx-auto leading-relaxed">
            Un assistant IA qui guide votre enfant par des questions, comme Socrate.
            Du CP à la Terminale, pour toutes les matières du programme français.
          </p>

          {/* CTA Buttons - Action claire */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 px-4">
            <Link href="http://localhost:5173/auth/register" className="w-full sm:w-auto">
              <Button size="xl" className="w-full sm:w-auto min-w-[200px] group shadow-lg">
                Essai gratuit 14 jours
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="#how-it-works" className="w-full sm:w-auto">
              <Button size="xl" variant="outline" className="w-full sm:w-auto min-w-[200px]">
                Voir comment ça marche
              </Button>
            </Link>
          </div>

          {/* Trust signals - Preuve sociale mesurable */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 text-xs sm:text-sm text-muted-foreground px-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              <span>Conforme programme Éducation Nationale</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              <span>Sans engagement</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              <span>Données hébergées en France</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
