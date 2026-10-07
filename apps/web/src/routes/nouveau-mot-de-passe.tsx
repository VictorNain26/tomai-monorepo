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

/** Where the link of a password reset lands, its token in the address (better-auth's `redirectTo`). */
export const Route = createFileRoute('/nouveau-mot-de-passe')({
  validateSearch: z.object({ token: z.string().optional(), error: z.string().optional() }),
  component: NewPassword,
});

const schema = z
  .object({
    password: z.string().min(8, '8 caractères au moins.').max(128, '128 caractères au plus.'),
    confirmation: z.string(),
  })
  .refine(({ password, confirmation }) => password === confirmation, { path: ['confirmation'], error: 'Les deux mots de passe diffèrent.' });

function NewPassword() {
  const { token, error } = Route.useSearch();
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { password: '', confirmation: '' } });

  const submit = form.handleSubmit(async ({ password }) => {
    if (!token) return;
    setFailure(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) setFailure(authMessage(error));
    else setDone(true);
  });

  return (
    <Page title="Nouveau mot de passe">
      {error ? (
        <Notice tone="error">Ce lien n’est plus valable. Demandez-en un nouveau.</Notice>
      ) : !token ? (
        <Notice tone="error">Ce lien est incomplet. Demandez-en un nouveau.</Notice>
      ) : done ? (
        <Notice tone="info">Votre mot de passe est changé, et vos autres connexions sont fermées.</Notice>
      ) : (
        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <Field
            label="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            {...form.register('password')}
            error={form.formState.errors.password?.message}
          />
          <Field
            label="Le même, une seconde fois"
            type="password"
            autoComplete="new-password"
            {...form.register('confirmation')}
            error={form.formState.errors.confirmation?.message}
          />
          {failure && <Notice tone="error">{failure}</Notice>}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Changer le mot de passe
          </Button>
        </form>
      )}
      <Link to="/connexion" className="min-h-11 py-3 text-sm text-primary underline">
        Aller à la connexion
      </Link>
    </Page>
  );
}
