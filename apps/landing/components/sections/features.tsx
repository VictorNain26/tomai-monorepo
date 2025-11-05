import { Brain, TrendingUp, BookOpen, Users, Shield, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Brain,
    title: "Questions plutôt que réponses",
    description: "L'IA guide votre enfant par des questions progressives, comme le ferait un tuteur. Il réfléchit, construit sa compréhension et retient mieux.",
  },
  {
    icon: BookOpen,
    title: "Programme Éducation Nationale",
    description: "Mathématiques, français, sciences, histoire-géographie. Du CP à la Terminale, aligné sur les programmes officiels 2024-2025.",
  },
  {
    icon: TrendingUp,
    title: "S'adapte au niveau réel",
    description: "L'IA ajuste la difficulté selon les réponses de votre enfant. Ni trop facile (ennui), ni trop difficile (découragement).",
  },
  {
    icon: Users,
    title: "Tableau de bord parents",
    description: "Suivez les sujets étudiés, le temps passé et les progrès. Identifiez les forces et les points à travailler.",
  },
  {
    icon: Shield,
    title: "Sécurité et confidentialité",
    description: "Hébergement en France, conforme RGPD. Vos données restent privées et ne sont jamais vendues à des tiers.",
  },
  {
    icon: Trophy,
    title: "Motivation par le progrès",
    description: "Badges de progression et objectifs personnalisés. Votre enfant voit ses efforts récompensés et reste motivé.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-16 sm:py-24 lg:py-32 bg-background">
      <div className="container">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center mb-12 sm:mb-16 px-4">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Comment TomAI aide votre enfant
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Une approche pédagogique centrée sur la compréhension profonde plutôt que la mémorisation.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 px-4">
          {features.map((feature, index) => (
            <Card key={index} className="group border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                  <feature.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg sm:text-xl text-foreground leading-tight">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
