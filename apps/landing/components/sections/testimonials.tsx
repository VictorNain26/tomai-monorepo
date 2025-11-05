import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const testimonials = [
  {
    name: "Sophie M.",
    role: "Maman de Léa, CM2",
    content: "Ma fille comprend mieux ses exercices de maths depuis qu'elle utilise TomAI. Elle pose ses questions et l'IA la guide sans lui donner la réponse directement. C'est exactement ce qu'il lui fallait.",
    rating: 5,
  },
  {
    name: "Thomas D.",
    role: "Papa de Lucas, 4ème",
    content: "Mon fils avait du mal en français. Avec TomAI, il revoit ses leçons de façon interactive. Je vois sa progression dans le tableau de bord parent, c'est rassurant.",
    rating: 5,
  },
  {
    name: "Claire L.",
    role: "Maman de Chloé, 2nde",
    content: "Ma fille prépare son contrôle de physique avec TomAI. L'IA pose des questions qui l'aident à réfléchir plutôt que mémoriser. Elle a repris confiance en ses capacités.",
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="py-16 sm:py-24 lg:py-32 bg-secondary/50">
      <div className="container">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center mb-12 sm:mb-16 px-4">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Témoignages de parents
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Des familles françaises qui utilisent TomAI au quotidien
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="mx-auto max-w-6xl grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 px-4">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-border bg-card">
              <CardContent className="pt-6">
                {/* Rating */}
                <div className="mb-4 flex gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-primary text-primary" />
                  ))}
                </div>

                {/* Content */}
                <p className="mb-4 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  &ldquo;{testimonial.content}&rdquo;
                </p>

                {/* Author */}
                <div className="border-t border-border pt-4">
                  <p className="font-semibold text-xs sm:text-sm text-foreground">{testimonial.name}</p>
                  <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
