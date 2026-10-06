import type { Metadata } from "next";
import { PageLayout } from "@/components/layout/page-layout";
import { FaqList } from "@/components/sections/faq-list";
import { buttonVariants } from "@repo/ui";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

const DESCRIPTION = `Les réponses aux questions fréquentes sur ${BRAND_NAME}.`;

export const metadata: Metadata = {
  title: "Centre d'aide",
  description: DESCRIPTION,
  alternates: {
    canonical: "/aide",
  },
};

export default function AidePage() {
  return (
    <PageLayout
      title="Centre d'aide"
      description={DESCRIPTION}
      maxWidth="3xl"
    >
      <h2 className="mb-4 text-2xl">Une question sur {BRAND_NAME} ?</h2>
      <p className="mb-8 max-w-md text-muted-foreground">
        Écrivez-nous : nous lisons chaque message.
      </p>
      <Link href="/contact" className={buttonVariants({ size: "lg" })}>
        Nous écrire
      </Link>

      <div className="mt-12">
        <FaqList />
      </div>
    </PageLayout>
  );
}
