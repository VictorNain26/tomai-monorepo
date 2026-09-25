import { GraduationCap, Landmark, ShieldCheck } from "lucide-react";
import { TomIllustration } from "../atoms/tom-illustration";
import { Highlight } from "../annotations/highlight";
import { HandNote } from "../annotations/hand-note";
import { WaitlistForm } from "../molecules/waitlist-form";

const SIGNALS = [
  { icon: Landmark, label: "Hébergé dans l'Union européenne" },
  { icon: ShieldCheck, label: "Gratuit pour commencer" },
];

export function Hero() {
  return (
    <section className="flex min-h-[calc(100svh-4rem)] items-start py-16 lg:py-24">
      <div className="container grid w-full grid-cols-1 items-center gap-16 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-sm font-bold ring-1 ring-border">
            <GraduationCap className="size-4 text-success" aria-hidden="true" />
            Collège, de la 6e à la 3e
          </span>

          <h1 className="mt-4 text-4xl text-balance text-foreground sm:text-6xl xl:text-7xl">
            Tom ne donne pas la réponse. Il aide votre enfant à <Highlight>la trouver</Highlight>.
          </h1>

          <p className="mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">
            Tom accompagne votre enfant dans ses devoirs comme un bon professeur : par des questions,
            à son niveau, jusqu&apos;à ce qu&apos;il trouve seul.
          </p>

          <HandNote className="mt-4">c&apos;est toi qui l&apos;écris !</HandNote>

          <WaitlistForm source="hero" className="mt-10 max-w-lg" />

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {SIGNALS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="size-4 text-success" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <TomIllustration className="mx-auto lg:mr-0" />
      </div>
    </section>
  );
}
