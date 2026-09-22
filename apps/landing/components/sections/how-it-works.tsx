import { FadeIn } from "../atoms/fade-in";
import { Scribble } from "../annotations/scribble";
import { Highlight } from "../annotations/highlight";
import { SectionHeader } from "../atoms/section-header";

const STEPS = [
  {
    title: "Il questionne",
    body: (
      <>
        Face à un exercice, Tom ne donne pas la solution. Il pose <Highlight>la question qui débloque</Highlight>, puis
        la suivante, et ne donne un indice plus précis que si votre enfant bloque vraiment.
      </>
    ),
  },
  {
    title: "Il s'adapte",
    body: (
      <>
        Vocabulaire, longueur des explications, notations : tout suit <Highlight>la classe de votre enfant</Highlight>,
        de la 6e à la 3e, et la matière travaillée.
      </>
    ),
  },
  {
    title: "Il fait réviser",
    body: (
      <>
        Ce qui a été compris devient des fiches, revues au bon moment grâce à <Highlight>la répétition espacée</Highlight>,
        pour que ça tienne jusqu&apos;au contrôle.
      </>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-24 lg:py-32">
      <div className="container">
        <SectionHeader eyebrow="La méthode" title="Comment Tom guide votre enfant" />
        <ol className="mx-auto grid max-w-5xl gap-12 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-l-2 border-annotation pl-6">
              <FadeIn delay={index * 0.15}>
                <Scribble kind="circle" className="mb-4 px-2 font-heading text-3xl text-annotation" delay={0.2 + index * 0.15}>
                  {index + 1}
                </Scribble>
                <h3 className="mb-3 text-2xl font-semibold text-foreground">{step.title}</h3>
                <p className="leading-relaxed text-muted-foreground">{step.body}</p>
              </FadeIn>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
