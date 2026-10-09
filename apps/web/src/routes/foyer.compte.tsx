import { Button } from '@repo/ui';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { CodeForm, sendCode } from '../components/code-form';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { SignOut } from '../components/sign-out';
import { authClient, authMessage, hasCode, isCancelled } from '../lib/auth';
import { deviceName, formatDay } from '../lib/device';
import { passkeysQuery } from '../lib/passkey';

/** The guardian's account, out of the household's home: their passkeys, and the sign-out. */
export const Route = createFileRoute('/foyer/compte')({
  loader: ({ context }) => context.queryClient.query(passkeysQuery),
  component: Account,
});

function Account() {
  return (
    <Page title="Mon compte">
      <Link to="/foyer" className="min-h-11 py-3 text-sm text-primary underline">
        Retour au foyer
      </Link>
      <Passkeys />
      <SignOut label="Se déconnecter" />
    </Page>
  );
}

/**
 * A passkey opens Tom with the phone's own lock, instead of a code by email. It is made within
 * minutes of entering (the server's freshAge); past them, a code confirms who is there first.
 */
function Passkeys() {
  const queryClient = useQueryClient();
  const { data: passkeys } = useSuspenseQuery(passkeysQuery);
  const [failure, setFailure] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: passkeysQuery.queryKey });

  const add = useMutation({
    mutationFn: async () => {
      setFailure(null);
      const { error } = await authClient.passkey.addPasskey();
      if (!error) return refresh();
      if (hasCode(error, 'SESSION_NOT_FRESH')) setStale(true);
      else if (!isCancelled(error)) setFailure(authMessage(error));
    },
  });
  const askCode = useMutation({
    mutationFn: async () => {
      setFailure(null);
      const { data } = await authClient.getSession();
      if (!data) return;
      const { error } = await sendCode(data.user.email);
      if (error) setFailure(authMessage(error));
      else setCodeSentTo(data.user.email);
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      setFailure(null);
      const { error } = await authClient.passkey.deletePasskey({ id });
      if (error) setFailure(authMessage(error));
      return refresh();
    },
  });

  return (
    <section aria-labelledby="passkeys" className="flex flex-col gap-3">
      <h2 id="passkeys" className="text-xl font-bold text-foreground">
        Vos clés d’accès
      </h2>
      <p className="text-muted-foreground">
        Une clé d’accès vous fait entrer par le verrouillage de votre téléphone ou de votre ordinateur, sans code par e-mail.
      </p>
      {passkeys.length > 0 && (
        <ul className="flex flex-col gap-2">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
              <span className="flex flex-col">
                <span className="font-bold">{deviceName(passkey.name)}</span>
                <span className="text-sm text-muted-foreground">Créée le {formatDay(passkey.createdAt)}</span>
              </span>
              <Button
                variant="outline"
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(passkey.id);
                }}
              >
                Supprimer
              </Button>
            </li>
          ))}
        </ul>
      )}
      {failure && <Notice tone="error">{failure}</Notice>}
      {codeSentTo ? (
        <CodeForm
          email={codeSentTo}
          submitLabel="Confirmer"
          onEntered={() => {
            setCodeSentTo(null);
            setStale(false);
          }}
        />
      ) : stale ? (
        <>
          <Notice tone="info">
            Par sécurité, une clé d’accès se crée dans les 10 minutes qui suivent votre entrée. Confirmez d’abord avec un code reçu par e-mail.
          </Notice>
          <Button
            disabled={askCode.isPending}
            onClick={() => {
              askCode.mutate();
            }}
          >
            Recevoir un code
          </Button>
        </>
      ) : (
        <Button
          disabled={add.isPending}
          onClick={() => {
            add.mutate();
          }}
        >
          Créer une clé d’accès sur cet appareil
        </Button>
      )}
    </section>
  );
}
