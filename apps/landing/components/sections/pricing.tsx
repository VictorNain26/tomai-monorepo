"use client";

import { Check, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@repo/ui";
import { SectionHeader } from "../atoms/section-header";

const FREE_FEATURES = [
  "Français, Maths, Anglais",
  "Du CP à la Terminale",
  "Volume d'échanges limité chaque jour",
  "Aide aux devoirs",
  "Suivi des matières travaillées",
];

const PREMIUM_FEATURES = [
  "Toutes les matières",
  "Du CP à la Terminale",
  "5 fois plus d'échanges par jour",
  "Fiches de révision + répétition espacée",
  "Tableau de bord parental complet",
  "Intégration Pronote",
  "Support prioritaire",
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 lg:py-32">
      <div className="container px-4 mx-auto">
        <SectionHeader
          title="Un prix simple, sans surprise"
          description="Commencez gratuitement, puis passez au plan Complet quand votre enfant en a besoin."
        />

        {/* Two Cards Side by Side */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto">
          {/* Free Card */}
          <div className="bg-card rounded-2xl p-8 border-2 border-border shadow-md hover:shadow-lg transition-shadow">
            <div className="mb-6">
              <div className="inline-block px-3 py-1 bg-secondary rounded-full text-sm font-medium text-foreground mb-4">
                Pour découvrir
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Gratuit</h3>
              <p className="text-3xl font-bold text-foreground">0€</p>
            </div>

            <ul className="space-y-4 mb-8">
              {FREE_FEATURES.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 text-success mt-0.5" />
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Button variant="outline" className="w-full group" asChild>
              <a href="#waitlist">
                Rejoindre la liste d&apos;attente
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </Button>
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

              {/* Price comparison */}
              <p className="text-sm text-muted-foreground mb-1">
                <span className="line-through">35€/h cours particulier</span>
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-bold text-foreground">15€</p>
                <span className="text-muted-foreground">/mois</span>
              </div>
              <p className="text-sm text-primary font-medium mt-1">
                Moins de 0,50€ par jour
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                +5€/mois par enfant supplémentaire
              </p>
            </div>

            <ul className="space-y-4 mb-8">
              {PREMIUM_FEATURES.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 text-success mt-0.5" />
                  <span className="text-foreground font-medium">{feature}</span>
                </li>
              ))}
            </ul>

            <Button className="w-full group" asChild>
              <a href="#waitlist">
                Être notifié du lancement
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </Button>

            {/* Guarantee badge */}
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-success" />
              <span>Satisfait ou remboursé</span>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Sans carte bancaire • Sans engagement
        </p>
      </div>
    </section>
  );
}
