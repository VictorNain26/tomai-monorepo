import { cn } from "@repo/ui";
import { FadeIn } from "../atoms/fade-in";
import { Scribble } from "../annotations/scribble";
import { SectionHeader } from "../atoms/section-header";

const STEPS = [
  {
    title: "Il pose sa question",
    body: "Une photo de l'exercice, sa voix ou le clavier, dans n'importe quelle matière.",
  },
  {
    title: "Tom cherche où ça coince",
    body: "Puis une question, un indice, une étape, à son niveau de la 6e à la 3e ; jamais la réponse de son exercice.",
  },
  {
    title: "Il trouve seul",
    body: "Et ce qu'il a compris revient en révision au bon moment, jusqu'au contrôle.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-16 lg:py-24">
      <div className="container">
        <SectionHeader eyebrow="La méthode" title="Comment Tom guide votre enfant" />
        <ol className="mx-auto grid max-w-5xl gap-12 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl bg-card p-8 shadow-sm ring-1 ring-border">
              <FadeIn delay={index * 0.15}>
                <Scribble
                  className={cn(
                    "mb-4 px-2 font-heading text-3xl",
                    index === 2 ? "text-success" : "text-annotation",
                  )}
                  delay={0.2 + index * 0.15}
                >
                  {index + 1}
                </Scribble>
                <h3 className="mb-4 text-xl text-foreground">{step.title}</h3>
                <p className="text-muted-foreground">{step.body}</p>
              </FadeIn>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
