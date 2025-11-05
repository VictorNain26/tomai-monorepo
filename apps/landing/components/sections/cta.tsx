import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="py-16 sm:py-24 lg:py-32 bg-background">
      <div className="container px-4">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-primary/80 px-6 py-12 sm:px-12 sm:py-16 lg:py-20 shadow-xl">
          <div className="relative mx-auto max-w-3xl text-center">
            <h2 className="mb-4 sm:mb-6 text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight text-white">
              Essayez gratuitement pendant 14 jours
            </h2>
            <p className="mb-6 sm:mb-8 text-base sm:text-lg lg:text-xl text-white/90 px-2">
              Aidez votre enfant à mieux comprendre ses cours. Sans engagement, résiliable en 1 clic.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link href="http://localhost:5173/auth/register" className="w-full sm:w-auto">
                <Button size="xl" variant="secondary" className="w-full sm:w-auto min-w-[200px] group shadow-lg text-sm sm:text-base">
                  Commencer l&apos;essai gratuit
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="#pricing" className="w-full sm:w-auto">
                <Button size="xl" variant="outline" className="w-full sm:w-auto min-w-[200px] bg-transparent text-white border-white/80 hover:bg-white hover:text-primary transition-colors text-sm sm:text-base">
                  Voir les tarifs
                </Button>
              </Link>
            </div>
            <p className="mt-4 sm:mt-6 text-xs sm:text-sm text-white/80">
              Sans carte bancaire · Résiliation en 1 clic · Support français
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
