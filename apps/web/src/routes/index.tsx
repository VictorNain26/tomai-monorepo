import { Button } from '@repo/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { DeviceSignOut } from '../components/device-sign-out';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { api, parseResponse } from '../lib/api';
import { pairedDevicesQuery } from '../lib/auth';
import { sessionsQuery } from '../lib/chat';
import { deviceName, formatDay } from '../lib/device';
import { meQuery } from '../lib/me';
import { z } from '../lib/zod';

/**
 * The home: the sign-in for a visitor, the household for a guardian, their space for a student:
 * their sessions with Tom, and every device paired to their account. A confirmation link that
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
  loader: ({ context }) => Promise.all([context.queryClient.query(sessionsQuery), context.queryClient.query(pairedDevicesQuery)]),
  component: StudentHome,
});

function StudentHome() {
  const { data: me } = useSuspenseQuery(meQuery);

  return (
    <Page title={`Bonjour ${me?.name ?? ''}`}>
      <Sessions />
      <Devices />
    </Page>
  );
}

function Sessions() {
  const navigate = useNavigate();
  const { data: sessions } = useSuspenseQuery(sessionsQuery);
  const start = useMutation({
    mutationFn: () => parseResponse(api.sessions.$post()),
    onSuccess: ({ id }) => navigate({ to: '/seance/$sessionId', params: { sessionId: id } }),
  });

  return (
    <section aria-labelledby="sessions" className="flex flex-col gap-3">
      <h2 id="sessions" className="text-xl font-bold text-foreground">
        Tes séances avec Tom
      </h2>
      <Button
        disabled={start.isPending}
        onClick={() => {
          start.mutate();
        }}
      >
        Nouvelle séance
      </Button>
      {start.error && <Notice tone="error">La séance n’a pas pu s’ouvrir. Réessaie dans un instant.</Notice>}
      {sessions.length > 0 && (
        <ul className="flex flex-col gap-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link
                to="/seance/$sessionId"
                params={{ sessionId: session.id }}
                className="flex min-h-11 flex-col rounded-lg border border-border bg-card p-4 text-card-foreground"
              >
                <span className="font-bold">{session.title ?? 'Séance sans titre'}</span>
                <span className="text-sm text-muted-foreground">{formatDay(session.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Devices() {
  const { data: devices } = useSuspenseQuery(pairedDevicesQuery);

  return (
    <section aria-labelledby="devices" className="flex flex-col gap-3">
      <h2 id="devices" className="text-xl font-bold text-foreground">
        Tes appareils reliés
      </h2>
      <ul className="flex flex-col gap-2">
        {devices.map((device) => (
          <li key={device.id} className="flex flex-col rounded-lg border border-border bg-card p-4 text-card-foreground">
            <span className="font-bold">{deviceName(device.userAgent)}</span>
            <span className="text-sm text-muted-foreground">Relié le {formatDay(device.createdAt)}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">Un appareil que tu ne reconnais pas ? Dis-le à ton parent : il peut le déconnecter.</p>
      <p className="text-sm text-muted-foreground">
        Sur un appareil partagé, déconnecte-toi en partant : ton parent te donnera un nouveau code pour revenir.
      </p>
      <DeviceSignOut label="Me déconnecter de cet appareil" />
    </section>
  );
}
