import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@repo/ui';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import type { z } from '../lib/zod';
import { Field, SelectField } from '../components/field';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { SignOut } from '../components/sign-out';
import { api, parseResponse } from '../lib/api';
import { LEVEL_LABELS, householdMessage, newStudentSchema, studentsQuery } from '../lib/household';
import { meQuery } from '../lib/me';

/** The guardian's household: their children, and the account of a new one. */
export const Route = createFileRoute('/foyer/')({
  loader: ({ context }) => context.queryClient.query(studentsQuery),
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
      <SignOut label="Se déconnecter" />
    </Page>
  );
}

function AddStudent() {
  const queryClient = useQueryClient();
  const form = useForm({ resolver: zodResolver(newStudentSchema), defaultValues: { name: '', birthMonth: '' } });
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
