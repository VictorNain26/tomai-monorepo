import { PageLayout } from "@/components/layout/page-layout";
import { FAQ } from "@/components/sections/faq";
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
      <div className="max-w-3xl mx-auto mb-24 text-center">
        <div className="rounded-2xl bg-card p-8 shadow-sm ring-1 ring-border md:p-12">
          <h3 className="mb-4 text-2xl font-semibold">Une question sur {BRAND_NAME} ?</h3>
          <p className="mx-auto mb-8 max-w-md text-muted-foreground">
            Écrivez-nous : nous lisons chaque message.
          </p>
          <Button size="lg" asChild>
            <Link href="/contact">Nous écrire</Link>
          </Button>
        </div>
      </div>

      <div className="relative">
        <FAQ />
      </div>
    </PageLayout>
  );
}
