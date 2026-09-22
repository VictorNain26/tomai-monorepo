import { ArrowRight, Check } from "lucide-react";
import { Button, cn } from "@repo/ui";
import { SectionHeader } from "../atoms/section-header";

const PLANS = [
  {
    name: "Gratuit",
    price: "0 €",
    tagline: "Pour découvrir",
    cta: "Rejoindre la liste d'attente",
    featured: false,
    features: [
      "Collège, de la 6e à la 3e",
      "Aide aux devoirs par questions",
      "Un volume d'échanges limité chaque jour",
      "Connexion Pronote",
      "Espace parent",
    ],
  },
  {
    name: "Complet",
    price: "Tarif annoncé au lancement",
    tagline: "Pour aller au bout",
    cta: "Être prévenu du lancement",
    featured: true,
    features: [
      "Tout le plan Gratuit",
      "Cinq fois plus d'échanges par jour",
      "Fiches de révision et répétition espacée",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 py-24 lg:py-32">
      <div className="container">
        <SectionHeader
          eyebrow="Tarifs"
          title="Deux formules, sans surprise"
          description="L'offre gratuite reste gratuite. Le tarif du plan Complet sera annoncé en premier aux inscrits de la liste d'attente."
        />
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "flex flex-col rounded-2xl border bg-card p-8",
                plan.featured ? "border-2 border-primary" : "border-border",
              )}
            >
              <p className="font-heading text-lg italic text-annotation">{plan.tagline}</p>
              <h3 className="mt-2 text-3xl font-semibold text-foreground">{plan.name}</h3>
              <p className="mt-2 text-lg font-semibold text-foreground">{plan.price}</p>
              <ul className="my-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-foreground">
                    <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button variant={plan.featured ? "default" : "outline"} className="group w-full" asChild>
                <a href="#waitlist">
                  {plan.cta}
                  <ArrowRight className="transition-transform duration-base group-hover:translate-x-1" aria-hidden="true" />
                </a>
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">Aucune carte bancaire pour l&apos;offre gratuite.</p>
      </div>
    </section>
  );
}
