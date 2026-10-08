import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@repo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { authClient, authMessage } from '../lib/auth';
import { meQuery } from '../lib/me';
import { z } from '../lib/zod';
import { Field } from './field';
import { Notice } from './notice';

const codeSchema = z.object({
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Le code à 6 chiffres reçu par e-mail.'),
});

export const sendCode = (email: string) => authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });

/** The code sent to the address, which opens a session: to enter, or to confirm who is there. */
export function CodeForm({ email, submitLabel, onEntered }: { email: string; submitLabel: string; onEntered: () => Promise<void> | void }) {
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
    await onEntered();
  });

  const resend = async () => {
    setFailure(null);
    const { error } = await sendCode(email);
    if (error) setFailure(authMessage(error));
    else setResent(true);
  };

  return (
    <>
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
          {submitLabel}
        </Button>
      </form>
      <button type="button" onClick={() => void resend()} className="min-h-11 py-3 text-left text-sm text-primary underline">
        Recevoir un nouveau code
      </button>
    </>
  );
}
