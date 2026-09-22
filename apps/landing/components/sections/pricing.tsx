"use client";

import { Check, ArrowRight } from "lucide-react";
import { Button } from "@repo/ui";
import { SectionHeader } from "../atoms/section-header";

const FREE_FEATURES = [
  "Collège, de la 6e à la 3e",
  "10 matières",
  "Volume d'échanges limité chaque jour",
  "Aide aux devoirs, méthode socratique",
  "Connexion Pronote",
  "Espace parent",
];

const PREMIUM_FEATURES = [
  "Tout le plan Gratuit",
  "5 fois plus d'échanges par jour",
  "Fiches de révision + répétition espacée",
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 lg:py-32">
      <div className="container px-4 mx-auto">
        <SectionHeader
          title="Deux formules, sans surprise"
          description="Commencez gratuitement. Le plan Complet ouvrira après le lancement, son tarif sera annoncé aux inscrits de la liste d'attente."
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

              <p className="text-lg font-semibold text-foreground">Tarif annoncé au lancement</p>
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
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          L&apos;offre gratuite ne demande aucune carte bancaire.
        </p>
      </div>
    </section>
  );
}
