import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { APP_URL } from "@/lib/urls";



export function Pricing() {
  return (
    <section id="pricing" className="py-24">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
            Un tarif unique et transparent
          </h2>
          <p className="text-lg text-muted-foreground">
            Accès complet à toutes les fonctionnalités. Sans engagement.
          </p>
        </div>

        <div className="max-w-lg mx-auto">
          <div className="relative flex flex-col p-8 rounded-3xl border border-primary bg-primary/5 shadow-xl">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-sm font-bold px-4 py-1 rounded-full">
              OFFRE DE LANCEMENT
            </div>

            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-foreground mb-2">Abonnement TomIA</h3>
              <div className="flex items-baseline justify-center gap-1 mb-4">
                <span className="text-5xl font-bold text-foreground">14,90€</span>
                <span className="text-muted-foreground">/mois</span>
              </div>
              <p className="text-muted-foreground">Pour un enfant</p>
            </div>

            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm text-foreground">Toutes les matières (CP à Terminale)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm text-foreground">Aide aux devoirs illimitée 24/7</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm text-foreground">Suivi parental détaillé</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm text-foreground">Mode révision examens</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm text-foreground">
                  <strong>+5€/mois</strong> par enfant supplémentaire
                </span>
              </li>
            </ul>

            <Link href={APP_URL} className="w-full">
              <Button size="lg" className="w-full text-lg h-12">
                Essayer gratuitement 7 jours
              </Button>
            </Link>
            <p className="text-xs text-center text-muted-foreground mt-4">
              Aucune carte bancaire requise pour l'essai.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
