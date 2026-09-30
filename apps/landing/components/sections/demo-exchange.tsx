import Image from "next/image";
import { cn } from "@repo/ui";
import tomTete from "@/assets/tom-tete.png";
import { FadeIn } from "../atoms/fade-in";
import { HandNote } from "../annotations/hand-note";

type Message = { from: "eleve" | "tom"; text: React.ReactNode };

const x = <i>x</i>;

const MESSAGES: Message[] = [
  { from: "eleve", text: <>3{x} + 5 = 20. J&apos;ai trouvé {x} = 20/3, mais c&apos;est faux.</> },
  {
    from: "tom",
    text: <>Tu as divisé 20 par 3 directement. Qu&apos;est-ce qui accompagne encore le 3{x}, à gauche du signe égal ?</>,
  },
  { from: "eleve", text: "Le + 5 ?" },
  { from: "tom", text: <>Oui. Que fais-tu de ce 5, des deux côtés, pour garder 3{x} seul ?</> },
  { from: "eleve", text: <>J&apos;enlève 5 : 3{x} = 15, donc {x} = 5.</> },
  { from: "tom", text: "Vérifie : combien font 3 × 5 + 5 ?" },
  { from: "eleve", text: "20. C'est bon !" },
];

const STAGGER_SECONDS = 0.15;

export function DemoExchange({ className }: { className?: string }) {
  return (
    <figure className={cn("rounded-2xl bg-secondary p-5 sm:p-6", className)}>
      <figcaption className="text-sm font-bold text-muted-foreground">Exemple de séance</figcaption>
      <ol className="mt-4 space-y-3">
        {MESSAGES.map(({ from, text }, index) => (
          <li key={index} className={cn("flex gap-2", from === "eleve" && "justify-end")}>
            <FadeIn delay={index * STAGGER_SECONDS} className="flex max-w-sm items-end gap-2">
              {from === "tom" && <Image src={tomTete} alt="" sizes="32px" className="size-8 shrink-0" />}
              <p
                className={cn(
                  "rounded-2xl px-4 py-2",
                  from === "tom" ? "bg-card text-card-foreground ring-1 ring-border" : "bg-primary text-primary-foreground",
                )}
              >
                <span className="sr-only">{from === "tom" ? "Tom : " : "L'élève : "}</span>
                {text}
              </p>
            </FadeIn>
          </li>
        ))}
      </ol>
      <FadeIn delay={MESSAGES.length * STAGGER_SECONDS} className="mt-3 ml-10">
        <HandNote>c&apos;est toi qui l&apos;as trouvé !</HandNote>
      </FadeIn>
    </figure>
  );
}
