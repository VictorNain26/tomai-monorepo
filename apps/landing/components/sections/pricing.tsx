import { Check } from "lucide-react";
import { cn } from "@repo/ui";
import { SectionHeader } from "../atoms/section-header";

const PLANS = [
  {
    name: "Gratuit",
    price: "0 €",
    tagline: "Pour découvrir",
    featured: false,
    features: [
      "Collège, de la 6e à la 3e",
      "Aide aux devoirs par questions",
      "Un volume d'échanges limité chaque jour",
      "Espace parent",
    ],
  },
  {
    name: "Complet",
    price: "Tarif annoncé au lancement",
    tagline: "Pour aller au bout",
    featured: true,
    features: [
      "Tout le plan Gratuit",
      "Plus d'échanges par jour",
      "Fiches de révision et répétition espacée",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 py-16 lg:py-24">
      <div className="container">
        <SectionHeader
          eyebrow="Tarifs"
          title="Deux formules, sans surprise"
          description="L'offre gratuite restera gratuite. Le tarif du plan Complet sera annoncé à l'ouverture."
        />
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "flex flex-col rounded-2xl bg-card p-8 shadow-sm",
                plan.featured ? "ring-2 ring-primary" : "ring-1 ring-border",
              )}
            >
              <p className="text-sm font-bold text-muted-foreground">{plan.tagline}</p>
              <h3 className="mt-2 text-xl text-foreground">{plan.name}</h3>
              <p className="mt-2 text-lg font-bold text-foreground">{plan.price}</p>
              <ul className="mt-8 space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-4 text-foreground">
                    <Check className="size-5 shrink-0 text-success" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">Aucune carte bancaire pour l&apos;offre gratuite.</p>
      </div>
    </section>
  );
}
