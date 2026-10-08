import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@repo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from '../lib/zod';
import { CodeForm, sendCode } from '../components/code-form';
import { Field } from '../components/field';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { authClient, authMessage, hasCode, isCancelled } from '../lib/auth';
import { meQuery } from '../lib/me';

/**
 * The guardian's way in, without a password: a passkey, which the browser offers in the address
 * field, or their address, then the code it receives. The first code creates the account, on an
 * invitation (closed beta); /bienvenue then asks its name.
 */
export const Route = createFileRoute('/_parent/connexion')({ component: SignIn });

const emailSchema = z.object({ email: z.email('Une adresse e-mail valide.') });

function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const enter = useCallback(() => navigate({ to: '/' }), [navigate]);

  if (email) {
    return (
      <Page title="Votre code">
        <CodeForm email={email} submitLabel="Entrer" onEntered={enter} />
        <button
          type="button"
          onClick={() => {
            setEmail(null);
          }}
          className="min-h-11 py-3 text-left text-sm text-primary underline"
        >
          Changer d’adresse
        </button>
      </Page>
    );
  }
  return <EmailStep onSent={setEmail} onEntered={enter} />;
}

function EmailStep({ onSent, onEntered }: { onSent: (email: string) => void; onEntered: () => Promise<void> }) {
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } });

  const submit = form.handleSubmit(async ({ email }) => {
    setFailure(null);
    const { error } = await sendCode(email);
    if (error) setFailure(authMessage(error));
    else onSent(email);
  });

  const entered = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
    await onEntered();
  }, [queryClient, onEntered]);

  // The browser offers the passkeys in the address field. Where it cannot (AUTH_CANCELLED), or
  // until one is chosen, nothing shows: the code is still there.
  useEffect(() => {
    void authClient.signIn.passkey({ autoFill: true }).then(async ({ error }) => {
      if (!error) await entered();
      else if (!isCancelled(error) && !hasCode(error, 'AUTH_CANCELLED')) setFailure(authMessage(error));
    });
  }, [entered]);

  const withPasskey = async () => {
    setFailure(null);
    const { error } = await authClient.signIn.passkey();
    if (!error) await entered();
    else if (!isCancelled(error)) setFailure(authMessage(error));
  };

  return (
    <Page title="Entrer dans Tom">
      <Notice tone="info">Tom est en bêta fermée : un compte se crée avec l’adresse e-mail qui a reçu une invitation.</Notice>
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <Field
          label="Adresse e-mail"
          type="email"
          autoComplete="username webauthn"
          {...form.register('email')}
          error={form.formState.errors.email?.message}
        />
        {failure && <Notice tone="error">{failure}</Notice>}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Recevoir mon code
        </Button>
      </form>
      <Button variant="outline" onClick={() => void withPasskey()}>
        Entrer avec une clé d’accès
      </Button>
      <Link to="/jumeler" className="min-h-11 py-3 text-sm text-primary underline">
        Tu es élève ? Relie cet appareil
      </Link>
    </Page>
  );
}
