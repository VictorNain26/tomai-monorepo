import { MessageSquare, Brain, ChartLine } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: MessageSquare,
    title: "Votre enfant pose sa question",
    description: "Il écrit sa question ou commence un exercice. L'IA détecte son niveau en analysant sa formulation et ses premières réponses.",
  },
  {
    number: "02",
    icon: Brain,
    title: "L'IA guide par des questions",
    description: "Plutôt que donner la réponse, l'IA pose des questions progressives pour aider votre enfant à construire sa propre compréhension.",
  },
  {
    number: "03",
    icon: ChartLine,
    title: "Les progrès sont suivis",
    description: "Chaque échange ajuste le niveau de difficulté. Vous visualisez l'évolution dans votre tableau de bord parent.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 sm:py-24 lg:py-32 bg-secondary/50">
      <div className="container">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center mb-12 sm:mb-16 px-4">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Comment ça marche ?
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Trois étapes pour aider votre enfant à mieux comprendre ses cours
          </p>
        </div>

        {/* Steps */}
        <div className="mx-auto max-w-4xl px-4">
          <div className="grid gap-10 sm:gap-12 md:gap-16">
            {steps.map((step, index) => (
              <div
                key={index}
                className="relative grid gap-4 sm:gap-6 md:grid-cols-[auto_1fr] md:gap-12"
              >
                {/* Connector Line (except last) */}
                {index < steps.length - 1 && (
                  <div className="absolute left-[31px] top-16 h-full w-px bg-border sm:left-[31px] md:left-[47px]" />
                )}

                {/* Icon Circle */}
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background md:h-24 md:w-24">
                  <step.icon className="h-7 w-7 text-primary sm:h-8 sm:w-8 md:h-12 md:w-12" />
                  <span className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground md:h-10 md:w-10 md:text-sm">
                    {step.number}
                  </span>
                </div>

                {/* Content */}
                <div className="space-y-2 pb-6 md:pb-0">
                  <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">
                    {step.title}
                  </h3>
                  <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
