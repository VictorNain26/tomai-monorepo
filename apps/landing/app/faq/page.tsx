import type { Metadata } from "next";
import { FAQ } from "@/components/sections/faq";
import { NotebookSheet } from "@/components/notebook/notebook-sheet";

export const metadata: Metadata = {
  title: "Questions fréquentes",
  description: "Retrouvez les réponses aux questions les plus fréquentes sur TomIA : méthode socratique, niveaux et matières, suivi parental, tarifs et compatibilité Pronote.",
  alternates: {
    canonical: "/faq",
  },
};

export default function FAQPage() {
  return (
    <NotebookSheet band>
      <FAQ />
    </NotebookSheet>
  );
}
