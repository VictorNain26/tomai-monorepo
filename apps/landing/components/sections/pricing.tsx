import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AppRoutes } from "@/lib/urls";

const TIERS = [
  {
    name: "Découverte",
    price: "Gratuit",
    description: "Pour tester la méthode TomIA sans engagement.",
    features: [
      "5 questions par jour",
      "Mathématiques uniquement",
      "Accès au tableau de bord basique",
      "Support par email"
    ],
    cta: "Créer un compte gratuit",
    href: "http://localhost:5173/auth/register",
    variant: "outline",
  },
  {
    name: "Réussite",
    price: "19,90€",
    period: "/mois",
    description: "L'accompagnement complet pour garantir la progression.",
    features: [
      "Questions illimitées",
      "Toutes les matières (CP à Terminale)",
      "Suivi parental détaillé",
      "Mode révision brevet & bac",
      "Support prioritaire 7j/7"
    ],
    cta: "Commencer l'essai gratuit",
    href: "http://localhost:5173/auth/register",
    variant: "default",
    popular: true,
  },
  {
    name: "Famille",
    price: "29,90€",
    period: "/mois",
    description: "Idéal pour les fratries. Jusqu'à 3 enfants inclus.",
    features: [
      "Tout du plan Réussite",
      "Jusqu'à 3 comptes enfants",
      "Tableau de bord unifié",
      "Suivi individualisé par enfant",
      "Facturation unique"
    ],
    cta: "Choisir l'offre Famille",
    href: "http://localhost:5173/auth/register",
    variant: "outline",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
            Un investissement pour son avenir
          </h2>
          <p className="text-lg text-muted-foreground">
            Des tarifs simples et transparents. Sans engagement, annulable à tout moment.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col p-8 rounded-3xl border ${
                tier.popular
                  ? "border-primary bg-primary/5 shadow-xl scale-105 z-10"
                  : "border-border bg-card hover:border-primary/30 transition-colors"
              }`}
            >
              {tier.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-sm font-bold px-4 py-1 rounded-full">
                  LE PLUS POPULAIRE
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-2">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-bold text-foreground">{tier.price}</span>
                  {tier.period && <span className="text-muted-foreground">{tier.period}</span>}
                </div>
                <p className="text-muted-foreground">{tier.description}</p>
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className={`h-5 w-5 shrink-0 ${tier.popular ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href={tier.href} className="w-full">
                <Button
                  variant={tier.variant as "default" | "outline"}
                  size="lg"
                  className="w-full"
                >
                  {tier.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
