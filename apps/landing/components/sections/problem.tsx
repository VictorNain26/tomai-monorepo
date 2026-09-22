import { FadeIn } from "../atoms/fade-in";
import { Scribble } from "../annotations/scribble";

export function Problem() {
  return (
    <section className="bg-seyes py-20">
      <FadeIn className="container max-w-4xl text-center">
        <p className="font-heading text-3xl font-medium text-balance text-foreground sm:text-4xl">
          Copier une réponse prend dix secondes.{" "}
          <Scribble kind="underline">L&apos;oublier aussi.</Scribble>
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Les outils qui donnent la solution font gagner du temps ce soir et en font perdre le jour
          du contrôle. Ce qu&apos;on comprend soi-même, on le garde.
        </p>
      </FadeIn>
    </section>
  );
}
