import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from '../lib/zod';
import { Page } from '../components/page';
import { mySessionsQuery } from '../lib/auth';
import { deviceName, formatDay } from '../lib/device';
import { meQuery } from '../lib/me';

/**
 * The home: the sign-in for a visitor, the household for a guardian, their space for a student,
 * with every device paired to their account. A confirmation link that
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
  loader: ({ context }) => context.queryClient.query(mySessionsQuery),
  component: StudentHome,
});

function StudentHome() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: sessions } = useSuspenseQuery(mySessionsQuery);

  return (
    <Page title={`Bonjour ${me?.name ?? ''}`}>
      <p className="text-muted-foreground">Ton espace arrive bientôt.</p>
      <section aria-labelledby="devices" className="flex flex-col gap-3">
        <h2 id="devices" className="text-xl font-bold text-foreground">
          Tes appareils reliés
        </h2>
        <ul className="flex flex-col gap-2">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-col rounded-lg border border-border bg-card p-4 text-card-foreground">
              <span className="font-bold">{deviceName(session.userAgent)}</span>
              <span className="text-sm text-muted-foreground">Relié le {formatDay(session.createdAt)}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Un appareil que tu ne reconnais pas ? Dis-le à ton parent : il peut le déconnecter.</p>
      </section>
    </Page>
  );
}
