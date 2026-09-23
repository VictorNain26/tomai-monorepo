import { FadeIn } from "../atoms/fade-in";
import { MarginNote } from "../annotations/margin-note";
import { Highlight } from "../annotations/highlight";

const COMMITMENTS = [
  "Données hébergées dans l'Union européenne, traitées selon le RGPD.",
  "Une IA européenne : les modèles de Mistral AI, appelés depuis l'Europe.",
  "Aucune publicité, aucune revente de données.",
  "Consultation, correction et suppression des données sur simple demande.",
];

export function Trust() {
  return (
    <section className="py-24 lg:py-32">
      <FadeIn className="container grid max-w-5xl gap-10 md:grid-cols-[1fr_2fr] md:items-start">
        <MarginNote className="text-2xl md:mt-2">Ce qu&apos;on s&apos;engage à faire, et à ne pas faire.</MarginNote>
        <div>
          <h2 className="mb-6 text-4xl font-semibold text-foreground sm:text-5xl">
            Les données d&apos;un enfant <Highlight>ne sont pas un produit</Highlight>
          </h2>
          <ul className="space-y-4 text-lg text-muted-foreground">
            {COMMITMENTS.map((item) => (
              <li key={item} className="border-l-2 border-success pl-4">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </FadeIn>
    </section>
  );
}
