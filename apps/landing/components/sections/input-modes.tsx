import { Camera, Keyboard, Mic } from "lucide-react";
import { FadeIn } from "../atoms/fade-in";

const MODES = [
  { icon: Camera, title: "Une photo", body: "de l'exercice, du manuel ou du cahier." },
  { icon: Mic, title: "La voix", body: "pour expliquer où ça coince, sans taper." },
  { icon: Keyboard, title: "Le clavier", body: "pour écrire sa réponse et la vérifier." },
];

export function InputModes() {
  return (
    <section className="pb-24 lg:pb-32">
      <FadeIn className="container max-w-5xl">
        <div className="grid gap-8 rounded-2xl border border-border bg-card p-8 sm:grid-cols-3 sm:p-10">
          {MODES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <Icon className="mt-1 size-6 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-muted-foreground">
                <span className="block font-heading text-xl font-semibold text-foreground">{title}</span>
                {body}
              </p>
            </div>
          ))}
        </div>
      </FadeIn>
    </section>
  );
}
