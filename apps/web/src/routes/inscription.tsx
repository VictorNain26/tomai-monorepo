import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@repo/ui';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Field } from '../components/field';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { authClient, authMessage } from '../lib/auth';

export const Route = createFileRoute('/inscription')({ component: SignUp });

const schema = z.object({
  name: z.string().trim().min(1, 'Votre prénom.').max(50, '50 caractères au plus.'),
  email: z.email('Une adresse e-mail valide.'),
  password: z.string().min(8, '8 caractères au moins.').max(128, '128 caractères au plus.'),
});

function SignUp() {
  const [failure, setFailure] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', password: '' } });

  const submit = form.handleSubmit(async ({ name, email, password }) => {
    setFailure(null);
    // The confirmation link brings the parent back here, signed in.
    const { error } = await authClient.signUp.email({ name, email, password, callbackURL: '/' });
    if (error) setFailure(authMessage(error));
    else setSentTo(email);
  });

  if (sentTo) {
    return (
      <Page title="Vérifiez votre e-mail">
        <Notice tone="info">Un lien de confirmation vient d’être envoyé à {sentTo}. Ouvrez-le pour activer votre compte.</Notice>
        <Link to="/connexion" className="min-h-11 py-3 text-sm text-primary underline">
          Retour à la connexion
        </Link>
      </Page>
    );
  }

  return (
    <Page title="Créer un compte parent">
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <Field label="Votre prénom" autoComplete="given-name" {...form.register('name')} error={form.formState.errors.name?.message} />
        <Field label="Adresse e-mail" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} />
        <Field
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          {...form.register('password')}
          error={form.formState.errors.password?.message}
        />
        {failure && <Notice tone="error">{failure}</Notice>}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Créer le compte
        </Button>
      </form>
      <Link to="/connexion" className="min-h-11 py-3 text-sm text-primary underline">
        J’ai déjà un compte
      </Link>
    </Page>
  );
}
