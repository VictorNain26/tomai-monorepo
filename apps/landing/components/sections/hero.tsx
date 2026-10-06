import { Hourglass, Landmark, ShieldCheck } from 'lucide-react';
import { TomIllustration } from '../atoms/tom-illustration';
import { Highlight } from '../annotations/highlight';
import { DemoExchange } from './demo-exchange';

const SIGNALS = [
  { icon: Landmark, label: "L'IA de Mistral AI, appelée en Europe" },
  { icon: ShieldCheck, label: 'Une offre gratuite, sans carte bancaire' },
];

export function Hero() {
  return (
    <section className="py-16 lg:py-24">
      <div className="container grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-sm font-bold ring-1 ring-border">
            <Hourglass className="size-4 text-success" aria-hidden="true" />
            En préparation&nbsp;: l&apos;application n&apos;est pas encore ouverte
          </span>

          <h1 className="mt-4 text-4xl text-balance text-foreground sm:text-6xl xl:text-7xl">
            Le soir, l&apos;exercice restera <Highlight>le sien</Highlight>.
          </h1>

          <p className="mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">
            Ce que nous construisons pour les collégiens, de la 6e à la&nbsp;3e&nbsp;: le soir, ce n&apos;est plus au parent d&apos;expliquer, et ce
            n&apos;est pas l&apos;IA qui fait l&apos;exercice.
          </p>

          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {SIGNALS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="size-4 text-success" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative lg:pl-24">
          <DemoExchange />
          <TomIllustration className="absolute -bottom-6 -left-16 hidden w-44 lg:block" />
        </div>
      </div>
    </section>
  );
}
