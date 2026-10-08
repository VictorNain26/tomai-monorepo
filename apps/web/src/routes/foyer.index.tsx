import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@repo/ui';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from '../lib/zod';
import { CodeForm, sendCode } from '../components/code-form';
import { CheckboxField, Field, SelectField } from '../components/field';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { SignOut } from '../components/sign-out';
import { api, parseResponse } from '../lib/api';
import { authClient, authMessage, hasCode, isCancelled } from '../lib/auth';
import { deviceName, formatDay } from '../lib/device';
import { LEVEL_LABELS, householdMessage, newStudentSchema, studentsQuery } from '../lib/household';
import { meQuery } from '../lib/me';
import { passkeysQuery } from '../lib/passkey';

/** The guardian's household: their children, the account of a new one, and their passkeys. */
export const Route = createFileRoute('/foyer/')({
  loader: ({ context }) => Promise.all([context.queryClient.query(studentsQuery), context.queryClient.query(passkeysQuery)]),
  component: Household,
});

function Household() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: students } = useSuspenseQuery(studentsQuery);

  return (
    <Page title={`Bonjour ${me?.name ?? ''}`}>
      <section aria-labelledby="children" className="flex flex-col gap-3">
        <h2 id="children" className="text-xl font-bold text-foreground">
          Vos enfants
        </h2>
        {students.length === 0 ? (
          <p className="text-muted-foreground">Ajoutez votre enfant : vous relierez ensuite son appareil avec un code.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {students.map((student) => (
              <li key={student.id}>
                <Link
                  to="/foyer/$studentId"
                  params={{ studentId: student.id }}
                  className="flex min-h-11 items-center justify-between rounded-lg border border-border bg-card p-4 text-card-foreground"
                >
                  <span className="font-bold">{student.name}</span>
                  <span className="text-sm text-muted-foreground">{LEVEL_LABELS[student.level]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <AddStudent />
      <Passkeys />
      <SignOut label="Se déconnecter" />
    </Page>
  );
}

function AddStudent() {
  const queryClient = useQueryClient();
  const form = useForm({ resolver: zodResolver(newStudentSchema), defaultValues: { name: '', birthMonth: '', memoryProposed: false } });
  const create = useMutation({
    mutationFn: (json: z.output<typeof newStudentSchema>) => parseResponse(api.household.students.$post({ json })),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: studentsQuery.queryKey });
    },
  });
  const submit = form.handleSubmit((values) => {
    create.mutate(values);
  });

  return (
    <section aria-labelledby="add" className="flex flex-col gap-3">
      <h2 id="add" className="text-xl font-bold text-foreground">
        Ajouter un enfant
      </h2>
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <Field label="Son prénom" autoComplete="off" {...form.register('name')} error={form.formState.errors.name?.message} />
        <SelectField label="Sa classe" options={LEVEL_LABELS} {...form.register('level')} error={form.formState.errors.level?.message} />
        <Field
          label="Son mois de naissance"
          type="month"
          placeholder="AAAA-MM"
          {...form.register('birthMonth')}
          error={form.formState.errors.birthMonth?.message}
        />
        <CheckboxField
          label="Proposer que Tom retienne ce qui a résisté"
          hint="Les notions de ses exercices et ce qui a été difficile, jamais ce qu’il écrit. Votre enfant accepte ou non, et peut tout effacer."
          {...form.register('memoryProposed')}
        />
        {create.error && (
          <Notice tone="error">
            {householdMessage(create.error, 'Vérifiez le prénom et le mois de naissance : votre enfant a entre 5 et 20 ans.')}
          </Notice>
        )}
        <Button type="submit" disabled={create.isPending}>
          Ajouter
        </Button>
      </form>
    </section>
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
