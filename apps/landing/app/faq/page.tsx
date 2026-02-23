import type { Metadata } from "next";
import { FAQ } from "@/components/sections/faq";

export const metadata: Metadata = {
  title: "Questions fréquentes",
  description: "Retrouvez les réponses aux questions les plus fréquentes sur TomIA : méthode socratique, programmes Éduscol, suivi parental, tarifs et compatibilité Pronote.",
  alternates: {
    canonical: "/faq",
  },
};

export default function FAQPage() {
  return <FAQ />;
}
