import { BellRing, Eye, EyeOff, LineChart } from "lucide-react";
import { FadeIn } from "../atoms/fade-in";
import { SectionHeader } from "../atoms/section-header";
import { Highlight } from "../annotations/highlight";

const POINTS = [
  { icon: LineChart, title: "Un résumé", body: "Matières travaillées, temps passé, notions qui résistent." },
  { icon: BellRing, title: "Une alerte", body: "Si votre enfant confie qu'il va mal, vous êtes prévenu." },
  { icon: Eye, title: "Il sait ce que vous voyez", body: "Votre enfant sait exactement ce qui vous est montré, et rien d'autre." },
  { icon: EyeOff, title: "Pas les conversations", body: "Votre enfant garde un espace à lui. Vous suivez ses progrès, pas ses messages." },
];

export function Parents() {
  return (
    <section id="parents" className="scroll-mt-20 py-16 lg:py-24">
      <div className="container">
        <SectionHeader
          eyebrow="Pour les parents"
          title={
            <>
              Vous savez où il en est, <Highlight>sans lire par-dessus son épaule</Highlight>
            </>
          }
        />
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2">
          {POINTS.map(({ icon: Icon, title, body }, index) => (
            <FadeIn key={title} delay={index * 0.1}>
              <div className="flex h-full gap-4 rounded-2xl bg-card shadow-sm ring-1 ring-border p-6">
                <Icon className="mt-2 size-6 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="mb-2 text-xl text-foreground">{title}</h3>
                  <p className="text-muted-foreground">{body}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
