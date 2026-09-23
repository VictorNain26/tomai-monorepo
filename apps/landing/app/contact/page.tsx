import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@repo/ui";

const CONTACT_EMAIL = "contact@tomia.fr";

export default function ContactPage() {
  return (
    <PageLayout title="Contactez-nous" description="Une question, une suggestion ? Écrivez-nous.">
      <div className="mx-auto mt-12 max-w-xl text-center">
        <h3 className="mb-4 text-2xl font-semibold">Par email</h3>
        <p className="mb-8 text-muted-foreground">Nous lisons chaque message.</p>
        <Button asChild size="lg">
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </Button>
      </div>
    </PageLayout>
  );
}
