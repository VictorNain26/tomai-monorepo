import type { Metadata } from 'next';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@repo/ui';

const CONTACT_EMAIL = 'contact@tomia.fr';

const DESCRIPTION = 'Une question, une suggestion ? Écrivez-nous.';

export const metadata: Metadata = {
  title: 'Contactez-nous',
  description: DESCRIPTION,
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  return (
    <PageLayout title="Contactez-nous" description={DESCRIPTION}>
      <div className="mt-12 max-w-xl">
        <h2 className="mb-4 text-2xl">Par email</h2>
        <p className="mb-8 text-muted-foreground">Nous lisons chaque message.</p>
        <Button asChild size="lg">
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </Button>
      </div>
    </PageLayout>
  );
}
