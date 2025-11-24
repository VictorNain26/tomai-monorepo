"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { APP_URL } from "@/lib/urls";
import { FadeIn } from "@/components/atoms/fade-in";

export function CTA() {
  return (
    <section className="pt-32 pb-24 relative overflow-hidden">
      {/* Background with subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background -z-10" />

      <div className="container px-4 mx-auto">
        <FadeIn>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
              Prêt à transformer les devoirs en réussite ?
            </h2>

            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Créez votre compte parent gratuitement en 2 minutes. Aucun paiement requis pour démarrer et découvrir la méthode TomIA.
            </p>

            <div className="flex flex-col items-center gap-6">
              <Link href={APP_URL} className="group">
                <div className="relative">
                  {/* Animated glow effect */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary via-blue-500 to-primary rounded-2xl blur-xl opacity-50 group-hover:opacity-75 animate-pulse transition-opacity duration-500" />

                  {/* Main button */}
                  <button className="relative px-10 py-5 text-lg font-bold rounded-xl bg-gradient-to-br from-primary via-primary/95 to-blue-600 text-white shadow-2xl hover:shadow-[0_20px_60px_rgba(8,112,184,0.5)] hover:scale-[1.05] active:scale-[0.97] transition-all duration-300 border-2 border-white/30 hover:border-white/50 flex items-center gap-3 cursor-pointer overflow-hidden">
                    {/* Animated shine effect on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

                    <span className="relative font-extrabold">Créer mon compte parent</span>
                    <ArrowRight className="relative h-5 w-5 group-hover:translate-x-2 transition-transform duration-300" />
                  </button>
                </div>
              </Link>

              <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Sans engagement</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Données protégées</span>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
