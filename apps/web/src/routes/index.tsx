import { Button } from '@repo/ui';
import { useState } from 'react';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { MemoryAnswer } from '../components/memory-answer';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { TomHead } from '../components/tom';
import { api, parseResponse } from '../lib/api';
import { sessionsQuery } from '../lib/chat';
import { deviceName, formatDay } from '../lib/device';
import { devicesQuery, meQuery } from '../lib/me';
import { memoryQuery } from '../lib/memory';

/**
 * The home: the sign-in for a visitor, the household for a guardian, their space for a student:
 * their sessions with Tom, and every device paired to their account.
 */
export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.query(meQuery);
    if (!me) throw redirect({ to: '/connexion' });
    if (me.role === 'guardian') throw redirect({ to: '/foyer' });
  },
  loader: ({ context }) => Promise.all([context.queryClient.query(sessionsQuery), context.queryClient.query(devicesQuery)]),
  component: StudentHome,
});

// The student's answer, said back to them once taken.
const ANSWERED = {
  accepted: 'C’est noté : Tom retiendra ce qui a résisté. Tu peux tout voir et tout effacer dans « Ce que Tom retient ».',
  declined: 'C’est noté : Tom ne retiendra rien d’une séance à l’autre.',
};

function StudentHome() {
  const { data: me } = useSuspenseQuery(meQuery);
  // Not awaited: the memory is optional, a failure of it leaves the sessions open.
  const { data: memory } = useQuery(memoryQuery);
  const [answered, setAnswered] = useState<keyof typeof ANSWERED | null>(null);

  return (
    <Page title={`Bonjour ${me?.name ?? ''}`}>
      {memory?.state === 'asked' && <MemoryAnswer onAnswered={setAnswered} />}
      {answered && <Notice tone="info">{ANSWERED[answered]}</Notice>}
      <Sessions />
      <Link to="/memoire" className="min-h-11 py-3 text-sm text-primary underline">
        Ce que Tom retient
      </Link>
      <Devices />
    </Page>
  );
}

function Sessions() {
  const navigate = useNavigate();
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: sessions } = useSuspenseQuery(sessionsQuery);
  const start = useMutation({
    mutationFn: (accompanied: boolean) => parseResponse(api.sessions.$post({ json: { accompanied } })),
    onSuccess: ({ id }) => navigate({ to: '/seance/$sessionId', params: { sessionId: id }, resetScroll: false }),
  });

  return (
    <section aria-labelledby="sessions" className="flex flex-col gap-3">
      <h2 id="sessions" className="text-xl font-bold text-foreground">
        Tes séances avec Tom
      </h2>
      <p className="flex items-center gap-3 text-muted-foreground">
        <TomHead className="size-10 shrink-0" />
        Un exercice qui résiste ? Ouvre une séance, on le reprend pas à pas.
      </p>
      {me?.accompanied ? (
        <>
          <Button
            disabled={start.isPending}
            onClick={() => {
              start.mutate(true);
            }}
          >
            Avec mon parent à côté
          </Button>
          <Button
            variant="outline"
            disabled={start.isPending}
            onClick={() => {
              start.mutate(false);
            }}
          >
            Sans mon parent ce soir
          </Button>
          <p className="text-sm text-muted-foreground">
            Quand tu travailles sur l’appareil de ta famille, ton parent peut ouvrir ton espace et relire tes séances.
          </p>
        </>
      ) : (
        <Button
          disabled={start.isPending}
          onClick={() => {
            start.mutate(false);
          }}
        >
          Nouvelle séance
        </Button>
      )}
      {start.error && <Notice tone="error">La séance n’a pas pu s’ouvrir. Réessaie dans un instant.</Notice>}
      {sessions.length > 0 && (
        <ul className="flex flex-col gap-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link
                to="/seance/$sessionId"
                params={{ sessionId: session.id }}
                // The session scrolls to its last message itself.
                resetScroll={false}
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
  const { data: devices } = useSuspenseQuery(devicesQuery);

  return (
    <section className="flex flex-col gap-3">
      <details className="flex flex-col gap-3">
        <summary className="min-h-11 cursor-pointer py-3 font-bold text-foreground">Tes appareils reliés</summary>
        <ul className="flex flex-col gap-2">
          {devices.map((device) => (
            <li key={device.id} className="flex flex-col rounded-lg border border-border bg-card p-4 text-card-foreground">
              <span className="font-bold">{deviceName(device.userAgent)}</span>
              <span className="text-sm text-muted-foreground">Relié le {formatDay(device.pairedAt)}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Un appareil que tu ne reconnais pas ? Dis-le à ton parent : il peut le déconnecter.</p>
        <p className="text-sm text-muted-foreground">Sur un appareil partagé, ton parent passe sur son profil sans te déconnecter.</p>
      </details>
      <Link to="/connexion" className="min-h-11 py-3 text-sm text-primary underline">
        Changer de profil
      </Link>
    </section>
  );
}
