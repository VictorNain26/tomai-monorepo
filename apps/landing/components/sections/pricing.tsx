import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AppRoutes } from "@/lib/urls";

const plans = [
  {
    name: "Découverte",
    price: "Gratuit",
    period: "",
    description: "Pour tester sans engagement",
    features: [
      "5 conversations par mois",
      "Toutes les matières du programme",
      "Accès limité au tableau de bord",
      "Support email sous 48h",
    ],
    cta: "Commencer gratuitement",
    href: AppRoutes.register,
    popular: false,
  },
  {
    name: "Famille",
    price: "19€",
    period: "/mois",
    description: "Le plus choisi par les parents",
    features: [
      "Conversations illimitées",
      "Programme CP à Terminale complet",
      "Tableau de bord parents détaillé",
      "Historique des échanges",
      "Export des rapports PDF",
      "Support email prioritaire",
      "Résiliation en 1 clic",
    ],
    cta: "Essayer 14 jours gratuits",
    href: AppRoutes.register,
    popular: true,
  },
  {
    name: "Famille Plus",
    price: "34€",
    period: "/mois",
    description: "Pour familles de 3+ enfants",
    features: [
      "Tout du plan Famille",
      "Jusqu'à 5 comptes enfants",
      "Statistiques comparatives entre enfants",
      "Suggestions de révision personnalisées",
      "Support email sous 4h",
      "Accès anticipé nouvelles matières",
    ],
    cta: "Essayer 14 jours gratuits",
    href: AppRoutes.register,
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-16 sm:py-24 lg:py-32 bg-background">
      <div className="container">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center mb-12 sm:mb-16 px-4">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Tarifs transparents
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Testez gratuitement 14 jours, puis choisissez votre formule. Résiliez quand vous voulez.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-6 max-w-6xl mx-auto px-4">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={cn(
                "relative flex flex-col transition-all duration-300",
                plan.popular && "border-primary shadow-xl md:scale-105"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-0 right-0 mx-auto w-fit rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Le plus populaire
                </div>
              )}

              <CardHeader className="pb-6">
                <CardTitle className="text-xl sm:text-2xl">{plan.name}</CardTitle>
                <CardDescription className="text-sm sm:text-base">{plan.description}</CardDescription>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-bold tracking-tight">{plan.price}</span>
                  <span className="text-sm sm:text-base text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>

              <CardContent className="flex-1 space-y-3">
                <ul className="space-y-2.5">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-primary mt-0.5" />
                      <span className="text-xs sm:text-sm text-muted-foreground leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-4">
                <Link href={plan.href} className="w-full">
                  <Button
                    className="w-full text-sm sm:text-base"
                    size="lg"
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Guarantee */}
        <div className="mt-10 sm:mt-12 text-center px-4">
          <p className="text-sm sm:text-base text-muted-foreground">
            ✓ 14 jours d&apos;essai gratuit · Sans carte bancaire · Résiliation en 1 clic
          </p>
        </div>
      </div>
    </section>
  );
}
