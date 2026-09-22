import { BellRing, CalendarDays, EyeOff, LineChart } from "lucide-react";
import { FadeIn } from "../atoms/fade-in";
import { SectionHeader } from "../atoms/section-header";
import { Scribble } from "../annotations/scribble";

const POINTS = [
  { icon: LineChart, title: "Un résumé", body: "Matières travaillées, temps passé, notions qui résistent." },
  { icon: BellRing, title: "Des alertes", body: "Quand une difficulté revient, vous êtes prévenu." },
  { icon: CalendarDays, title: "Pronote", body: "Devoirs, notes et emploi du temps : Tom part de ce qui est vraiment à faire." },
  { icon: EyeOff, title: "Pas les conversations", body: "Votre enfant garde un espace à lui. Vous suivez ses progrès, pas ses messages." },
];

export function Parents() {
  return (
    <section id="parents" className="bg-seyes scroll-mt-20 py-24 lg:py-32">
      <div className="container">
        <SectionHeader
          eyebrow="Pour les parents"
          title={
            <>
              Vous savez où il en est, <Scribble kind="underline">sans lire par-dessus son épaule</Scribble>
            </>
          }
        />
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2">
          {POINTS.map(({ icon: Icon, title, body }, index) => (
            <FadeIn key={title} delay={index * 0.1}>
              <div className="flex h-full gap-4 rounded-2xl border border-border bg-card p-6">
                <Icon className="mt-1 size-6 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="mb-1 text-xl font-semibold text-foreground">{title}</h3>
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
