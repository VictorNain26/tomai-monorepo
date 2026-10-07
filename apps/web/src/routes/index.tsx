import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { Page } from '../components/page';
import { meQuery } from '../lib/me';

/**
 * The home: the sign-in for a visitor, the household for a guardian. A confirmation link that
 * failed lands here with its error (better-auth's `callbackURL`), shown on the error page.
 */
export const Route = createFileRoute('/')({
  validateSearch: z.object({ error: z.string().optional() }),
  beforeLoad: async ({ context, search }) => {
    if (search.error) throw redirect({ to: '/erreur-connexion', search: { error: search.error } });
    const me = await context.queryClient.query(meQuery);
    if (!me) throw redirect({ to: '/connexion' });
    if (me.role === 'guardian') throw redirect({ to: '/foyer' });
  },
  component: StudentHome,
});

function StudentHome() {
  return (
    <Page title="Tom">
      <p className="text-muted-foreground">Ton espace arrive bientôt.</p>
    </Page>
  );
}
