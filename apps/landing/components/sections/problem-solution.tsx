import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ProblemSolution() {
  return (
    <section className="py-16 sm:py-24 bg-secondary/30">
      <div className="container px-4">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
            Le dilemme des devoirs à la maison
          </h2>
          <p className="text-lg text-muted-foreground">
            Entre le manque de temps et les programmes qui changent, aider son enfant peut devenir une source de conflit.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center max-w-5xl mx-auto">
          {/* Problem Side */}
          <div className="space-y-8">
            <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xl font-semibold text-destructive mb-6 flex items-center gap-2">
                <XCircle className="h-6 w-6" />
                Sans TomIA
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-muted-foreground">
                  <XCircle className="h-5 w-5 text-destructive/60 shrink-0 mt-0.5" />
                  <span>Conflits et tensions pendant les devoirs</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <XCircle className="h-5 w-5 text-destructive/60 shrink-0 mt-0.5" />
                  <span>Incertitude sur les méthodes actuelles</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <XCircle className="h-5 w-5 text-destructive/60 shrink-0 mt-0.5" />
                  <span>Risque de donner les réponses sans expliquer</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <XCircle className="h-5 w-5 text-destructive/60 shrink-0 mt-0.5" />
                  <span>Outils IA génériques non sécurisés</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Solution Side */}
          <div className="space-y-8">
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-xl">
                RECOMMANDÉ
              </div>
              <h3 className="text-xl font-semibold text-primary mb-6 flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6" />
                Avec TomIA
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>Un tuteur patient qui ne s&apos;énerve jamais</span>
                </li>
                <li className="flex items-start gap-3 text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>L&apos;enfant devient autonome dans ses devoirs</span>
                </li>
                <li className="flex items-start gap-3 text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>Vous retrouvez des soirées paisibles</span>
                </li>
                <li className="flex items-start gap-3 text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>Environnement 100% sûr et sans distraction</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
