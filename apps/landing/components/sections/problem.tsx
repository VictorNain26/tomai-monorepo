import { FadeIn } from "../atoms/fade-in";
import { Highlight } from "../annotations/highlight";

export function Problem() {
  return (
    <section className="py-20">
      <FadeIn className="container max-w-4xl text-center">
        <h2 className="font-heading text-3xl text-balance text-foreground sm:text-4xl">
          Copier une réponse prend dix secondes. <Highlight>L&apos;oublier aussi.</Highlight>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Les outils qui donnent la solution font gagner du temps ce soir et en font perdre le jour
          du contrôle. Ce qu&apos;on comprend soi-même, on le garde.
        </p>
      </FadeIn>
    </section>
  );
}
