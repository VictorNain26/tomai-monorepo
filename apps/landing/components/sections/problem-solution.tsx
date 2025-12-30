import { CheckCircle2, XCircle } from "lucide-react";

export function ProblemSolution() {
  return (
    <section className="py-16 sm:py-24 bg-secondary/30">
      <div className="container px-4">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
            Les devoirs, sans les conflits
          </h2>
          <p className="text-lg text-muted-foreground">
            Entre le manque de temps et les programmes qui ont changé depuis votre scolarité, aider son enfant peut vite devenir stressant.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center max-w-5xl mx-auto">
          {/* Problem Side */}
          <div className="space-y-8">
            <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xl font-semibold text-destructive mb-6 flex items-center gap-2">
                <XCircle className="h-6 w-6" />
                Sans Tom
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-muted-foreground">
                  <XCircle className="h-5 w-5 text-destructive/60 shrink-0 mt-0.5" />
                  <span>Les programmes ont changé, difficile d&apos;expliquer</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <XCircle className="h-5 w-5 text-destructive/60 shrink-0 mt-0.5" />
                  <span>Pas le temps après une journée de travail</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <XCircle className="h-5 w-5 text-destructive/60 shrink-0 mt-0.5" />
                  <span>ChatGPT donne les réponses, pas les méthodes</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground">
                  <XCircle className="h-5 w-5 text-destructive/60 shrink-0 mt-0.5" />
                  <span>Les cours particuliers coûtent cher</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Solution Side */}
          <div className="space-y-8">
            <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xl font-semibold text-green-600 dark:text-green-400 mb-6 flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6" />
                Avec Tom
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span>Un tuteur patient, disponible soir et week-end</span>
                </li>
                <li className="flex items-start gap-3 text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span>Votre enfant comprend et gagne en autonomie</span>
                </li>
                <li className="flex items-start gap-3 text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span>Tableau de bord pour suivre ses progrès</span>
                </li>
                <li className="flex items-start gap-3 text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span>À partir de 15€/mois, sans engagement</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
