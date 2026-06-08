"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { FadeIn } from "../atoms/fade-in";

export function ProblemSolution() {
  return (
    <section className="py-16 sm:py-24 bg-secondary/50">
      <div className="container px-4">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <FadeIn>
            <p className="text-lg text-muted-foreground italic mb-4">
              Il est 19h, votre enfant bloque sur ses maths...
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
              Les devoirs, sans les conflits
            </h2>
            <p className="text-lg text-muted-foreground">
              Entre le manque de temps et les programmes qui ont changé depuis votre scolarité, aider son enfant peut vite devenir stressant.
            </p>
          </FadeIn>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8 lg:gap-12 items-center max-w-5xl mx-auto">
          {/* Problem Side */}
          <FadeIn direction="left">
            <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xl font-semibold text-destructive mb-6 flex items-center gap-2">
                <XCircle className="h-6 w-6" />
                Sans TomIA
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-muted-foreground">
                  <XCircle className="h-5 w-5 text-destructive/60 shrink-0 mt-0.5" />
                  <span>Les programmes ont changé — difficile d&apos;expliquer ce qu&apos;on ne maîtrise plus</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <XCircle className="h-5 w-5 text-destructive/60 shrink-0 mt-0.5" />
                  <span>Après 8h de travail, ni le temps ni la patience</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <XCircle className="h-5 w-5 text-destructive/60 shrink-0 mt-0.5" />
                  <span>ChatGPT donne les réponses — votre enfant oublie demain</span>
                </li>
              </ul>
            </div>
          </FadeIn>

          {/* Solution Side */}
          <FadeIn direction="right">
            <div className="bg-success/5 border border-success/20 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xl font-semibold text-success mb-6 flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6" />
                Avec TomIA
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                  <span>Un tuteur patient, disponible soir et week-end, connecté à Pronote</span>
                </li>
                <li className="flex items-start gap-3 text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                  <span>Votre enfant comprend et retient — pas de copier-coller</span>
                </li>
                <li className="flex items-start gap-3 text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                  <span>Vous suivez ses progrès depuis votre tableau de bord</span>
                </li>
              </ul>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
