import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { APP_URL } from "@/lib/urls";

const FREE_FEATURES = [
  "Français, Maths, Anglais",
  "Du CP à la Terminale",
  "~10 questions par jour",
  "Aide aux devoirs",
  "Suivi des progrès",
];

const PREMIUM_FEATURES = [
  "Toutes les matières",
  "Du CP à la Terminale",
  "Questions illimitées",
  "Aide aux devoirs",
  "Suivi des progrès",
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 lg:py-32 bg-secondary/30">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-3">
            Commencez gratuitement
          </h2>
          <p className="text-lg text-muted-foreground">
            Testez avec les matières principales, puis débloquez tout
          </p>
        </div>

        {/* Two Cards Side by Side */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Free Card */}
          <div className="bg-card rounded-2xl p-8 border-2 border-border shadow-md hover:shadow-lg transition-shadow">
            <div className="mb-6">
              <div className="inline-block px-3 py-1 bg-secondary rounded-full text-sm font-medium text-foreground mb-4">
                Pour tester
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Gratuit</h3>
              <p className="text-3xl font-bold text-foreground">0€</p>
            </div>

            <ul className="space-y-4 mb-8">
              {FREE_FEATURES.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 text-green-500 mt-0.5" />
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Link href={APP_URL}>
              <Button variant="outline" size="lg" className="w-full">
                Commencer
              </Button>
            </Link>
          </div>

          {/* Premium Card */}
          <div className="bg-card rounded-2xl p-8 border-2 border-primary shadow-lg hover:shadow-xl transition-shadow relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full">
                Recommandé
              </span>
            </div>

            <div className="mb-6">
              <div className="inline-block px-3 py-1 bg-primary/10 rounded-full text-sm font-medium text-primary mb-4">
                Accès complet
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Complet</h3>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-bold text-foreground">15€</p>
                <span className="text-muted-foreground">/mois</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                +5€/mois par enfant supplémentaire
              </p>
            </div>

            <ul className="space-y-4 mb-8">
              {PREMIUM_FEATURES.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 text-green-500 mt-0.5" />
                  <span className="text-foreground font-medium">{feature}</span>
                </li>
              ))}
            </ul>

            <Link href={APP_URL}>
              <Button size="lg" className="w-full">
                Essayer gratuitement
              </Button>
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Sans carte bancaire • Sans engagement
        </p>
      </div>
    </section>
  );
}
