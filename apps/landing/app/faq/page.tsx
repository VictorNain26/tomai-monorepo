import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/layout/page-layout";
import { FaqList } from "@/components/sections/faq-list";
import { BRAND_NAME } from "@/lib/brand";

const DESCRIPTION = `Retrouvez les réponses aux questions les plus fréquentes sur ${BRAND_NAME} : méthode socratique, niveaux et matières, suivi parental, tarifs et compatibilité Pronote.`;

export const metadata: Metadata = {
  title: "Questions fréquentes",
  description: DESCRIPTION,
  alternates: {
    canonical: "/faq",
  },
};

export default function FAQPage() {
  return (
    <PageLayout title="Questions fréquentes" description={DESCRIPTION}>
      <FaqList />

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Vous avez une autre question ?{" "}
        <Link href="/contact" className="text-primary underline underline-offset-4">
          Contactez-nous
        </Link>
      </p>
    </PageLayout>
  );
}
