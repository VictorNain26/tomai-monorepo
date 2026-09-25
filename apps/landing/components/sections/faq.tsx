import Link from "next/link";
import { SectionHeader } from "../atoms/section-header";
import { FaqList } from "./faq-list";

export function FAQ() {
  return (
    <section id="faq" className="scroll-mt-20 py-24 lg:py-32">
      <div className="container">
        <SectionHeader
          eyebrow="Questions"
          title="Ce que les parents nous demandent"
        />

        <FaqList />

        <p className="text-center text-sm text-muted-foreground mt-8">
          Vous avez une autre question ?{" "}
          <Link href="/contact" className="text-primary hover:underline">
            Contactez-nous
          </Link>
        </p>
      </div>
    </section>
  );
}
