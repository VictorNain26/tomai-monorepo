import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { APP_URL } from "@/lib/urls";

const PLANS = [
  {
    name: "Découverte",
    price: "Gratuit",
    period: "",
    subtitle: "",
    description: "Pour découvrir TomIA avec votre enfant",
    features: [
      "Français, Maths et Anglais",
      "Guidage intelligent sans donner les réponses",
      "Suivi de progression",
    ],
    highlighted: false,
  },
  {
    name: "Complet",
    price: "14,90€",
    period: "/mois",
    subtitle: "puis 5€/mois par enfant supplémentaire",
    description: "Toutes les matières pour réussir toute l'année",
    features: [
      "Toutes les matières (CP → Terminale)",
      "Mode révision examens",
      "Support prioritaire",
    ],
    highlighted: true,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24">
      <div className="container px-4 mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
            Tarifs simples et transparents
          </h2>
          <p className="text-lg text-muted-foreground">
            Commencez gratuitement, abonnez vos enfants quand vous le souhaitez.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col p-8 rounded-2xl border transition-all duration-200 ${
                plan.highlighted
                  ? "border-primary bg-primary/5 shadow-lg"
                  : "border-border bg-card hover:border-primary/50 hover:shadow-md"
              }`}
            >
              {/* Header */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {plan.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-muted-foreground">{plan.period}</span>
                  )}
                </div>
                {plan.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.subtitle}
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 flex-1">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check
                      className={`h-5 w-5 shrink-0 ${
                        plan.highlighted ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Single CTA */}
        <div className="text-center mt-12">
          <Link href={APP_URL}>
            <Button size="xl">
              Commencer gratuitement
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-4">
            Sans engagement · Annulez à tout moment
          </p>
        </div>
      </div>
    </section>
  );
}
