import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@repo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from '../lib/zod';
import { Field } from '../components/field';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { authClient, authMessage } from '../lib/auth';
import { meQuery } from '../lib/me';

/**
 * The guardian's one way in, without a password: their address, then the code it receives. The
 * first code creates the account, on an invitation (closed beta); /bienvenue then asks its name.
 */
export const Route = createFileRoute('/_parent/connexion')({ component: SignIn });

const emailSchema = z.object({ email: z.email('Une adresse e-mail valide.') });
const codeSchema = z.object({
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Le code à 6 chiffres reçu par e-mail.'),
});

const sendCode = (email: string) => authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });

function SignIn() {
  const [email, setEmail] = useState<string | null>(null);
  if (email) {
    return (
      <CodeStep
        email={email}
        onOtherAddress={() => {
          setEmail(null);
        }}
      />
    );
  }
  return <EmailStep onSent={setEmail} />;
}

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } });

  const submit = form.handleSubmit(async ({ email }) => {
    setFailure(null);
    const { error } = await sendCode(email);
    if (error) setFailure(authMessage(error));
    else onSent(email);
  });

  return (
    <Page title="Entrer dans Tom">
      <Notice tone="info">Tom est en bêta fermée : un compte se crée avec l’adresse e-mail qui a reçu une invitation.</Notice>
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <Field label="Adresse e-mail" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} />
        {failure && <Notice tone="error">{failure}</Notice>}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Recevoir mon code
        </Button>
      </form>
      <Link to="/jumeler" className="min-h-11 py-3 text-sm text-primary underline">
        Tu es élève ? Relie cet appareil
      </Link>
    </Page>
  );
}

function CodeStep({ email, onOtherAddress }: { email: string; onOtherAddress: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const form = useForm({ resolver: zodResolver(codeSchema), defaultValues: { otp: '' } });

  const submit = form.handleSubmit(async ({ otp }) => {
    setFailure(null);
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    if (error) {
      setFailure(authMessage(error));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
    await navigate({ to: '/' });
  });

  const resend = async () => {
    setFailure(null);
    const { error } = await sendCode(email);
    if (error) setFailure(authMessage(error));
    else setResent(true);
  };

  return (
    <Page title="Votre code">
      <Notice tone="info">
        {resent ? 'Un nouveau code' : 'Un code à 6 chiffres'} vient d’être envoyé à {email}. Il est valable 5 minutes.
      </Notice>
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <Field
          label="Le code reçu par e-mail"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          {...form.register('otp')}
          error={form.formState.errors.otp?.message}
        />
        {failure && <Notice tone="error">{failure}</Notice>}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Entrer
        </Button>
      </form>
      <div className="flex flex-col gap-2 text-sm">
        <button type="button" onClick={() => void resend()} className="min-h-11 py-3 text-left text-primary underline">
          Recevoir un nouveau code
        </button>
        <button type="button" onClick={onOtherAddress} className="min-h-11 py-3 text-left text-primary underline">
          Changer d’adresse
        </button>
      </div>
    </Page>
  );
}
