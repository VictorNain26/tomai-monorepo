import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@repo/ui';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from '../lib/zod';
import { Field } from '../components/field';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { authClient, authMessage } from '../lib/auth';

export const Route = createFileRoute('/_parent/mot-de-passe-oublie')({ component: ForgottenPassword });

const schema = z.object({ email: z.email('Une adresse e-mail valide.') });

function ForgottenPassword() {
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const submit = form.handleSubmit(async ({ email }) => {
    setFailure(null);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: '/nouveau-mot-de-passe' });
    if (error) setFailure(authMessage(error));
    else setSent(true);
  });

  return (
    <Page title="Mot de passe oublié">
      {sent ? (
        // The same answer whether the address has an account or not: it tells nobody.
        <Notice tone="info">Si un compte existe avec cette adresse, un lien pour choisir un nouveau mot de passe vient de lui être envoyé.</Notice>
      ) : (
        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <Field label="Adresse e-mail" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} />
          {failure && <Notice tone="error">{failure}</Notice>}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Recevoir un lien
          </Button>
        </form>
      )}
      <Link to="/connexion" className="min-h-11 py-3 text-sm text-primary underline">
        Retour à la connexion
      </Link>
    </Page>
  );
}
