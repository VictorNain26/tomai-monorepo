import { PageLayout } from "@/components/layout/page-layout";
import { FaqList } from "@/components/sections/faq-list";
import { Button } from "@repo/ui";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

export default function AidePage() {
  return (
    <PageLayout
      title="Centre d'aide"
      description={`Les réponses aux questions fréquentes sur ${BRAND_NAME}.`}
      maxWidth="5xl"
    >
      <div className="max-w-3xl">
        <h3 className="mb-4 text-2xl font-semibold">Une question sur {BRAND_NAME} ?</h3>
        <p className="mb-8 max-w-md text-muted-foreground">
          Écrivez-nous : nous lisons chaque message.
        </p>
        <Button size="lg" asChild>
          <Link href="/contact">Nous écrire</Link>
        </Button>
      </div>

      <div className="mt-12">
        <FaqList />
      </div>
    </PageLayout>
  );
}
