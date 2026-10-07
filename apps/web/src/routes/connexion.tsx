import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@repo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Field } from '../components/field';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { authClient, authMessage } from '../lib/auth';
import { meQuery } from '../lib/me';

export const Route = createFileRoute('/connexion')({ component: SignIn });

const schema = z.object({
  email: z.email('Une adresse e-mail valide.'),
  password: z.string().min(1, 'Votre mot de passe.'),
});

function SignIn() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const submit = form.handleSubmit(async ({ email, password }) => {
    setFailure(null);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setFailure(authMessage(error));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
    await navigate({ to: '/' });
  });

  return (
    <Page title="Connexion">
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <Field label="Adresse e-mail" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} />
        <Field
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          {...form.register('password')}
          error={form.formState.errors.password?.message}
        />
        {failure && <Notice tone="error">{failure}</Notice>}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Se connecter
        </Button>
      </form>
      <nav className="flex flex-col gap-2 text-sm">
        <Link to="/mot-de-passe-oublie" className="min-h-11 py-3 text-primary underline">
          Mot de passe oublié
        </Link>
        <Link to="/inscription" className="min-h-11 py-3 text-primary underline">
          Créer un compte parent
        </Link>
      </nav>
    </Page>
  );
}
