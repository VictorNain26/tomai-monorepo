import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@repo/ui';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from '../lib/zod';
import { CheckboxField, Field, SelectField } from '../components/field';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { api, parseResponse } from '../lib/api';
import { LEVEL_LABELS, householdMessage, newStudentSchema, studentsQuery, type Student } from '../lib/household';
import { meQuery } from '../lib/me';
import { minutesText, summaryQuery } from '../lib/summary';

/** The guardian's household: a card per child with their week, and the adding of a new one. */
export const Route = createFileRoute('/foyer/')({
  loader: ({ context }) => context.queryClient.query(studentsQuery),
  component: Household,
});

function Household() {
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: students } = useSuspenseQuery(studentsQuery);

  return (
    <Page title={`Bonjour ${me?.name ?? ''}`}>
      <Link to="/foyer/compte" className="min-h-11 self-end py-3 text-sm text-primary underline">
        Mon compte
      </Link>
      <section aria-labelledby="children" className="flex flex-col gap-3">
        <h2 id="children" className="text-xl font-bold text-foreground">
          Vos enfants
        </h2>
        {students.length === 0 ? (
          <p className="text-muted-foreground">Ajoutez votre enfant : Tom vous dira ensuite comment commencer.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {students.map((student) => (
              <li key={student.id}>
                <ChildCard child={student} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <AddStudent open={students.length === 0} />
    </Page>
  );
}

/** A child, their class, and their week in a line; the week not read yet, or failing, leaves the card. */
function ChildCard({ child }: { child: Student }) {
  const { data: week } = useQuery(summaryQuery(child.id));
  return (
    <Link
      to="/foyer/$studentId"
      params={{ studentId: child.id }}
      className="flex min-h-11 flex-col gap-1 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="font-bold">{child.name}</span>
        <span className="text-sm text-muted-foreground">{LEVEL_LABELS[child.level]}</span>
      </span>
      {week && (
        <span className="text-sm text-muted-foreground">
          {week.sessions === 0 ? 'Pas de séance cette semaine' : `Cette semaine : ${minutesText(week.minutes)}`}
        </span>
      )}
    </Link>
  );
}

/** The adding of a child, folded once one exists; then their page, which says the next step. */
function AddStudent({ open }: { open: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [unfolded, setUnfolded] = useState(false);
  const form = useForm({ resolver: zodResolver(newStudentSchema), defaultValues: { name: '', birthMonth: '', memoryProposed: false } });
  const create = useMutation({
    mutationFn: (json: z.output<typeof newStudentSchema>) => parseResponse(api.household.students.$post({ json })),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: studentsQuery.queryKey });
      await navigate({ to: '/foyer/$studentId', params: { studentId: id }, search: { ajoute: true } });
    },
  });
  const submit = form.handleSubmit((values) => {
    create.mutate(values);
  });

  if (!open && !unfolded) {
    return (
      <Button
        variant="outline"
        onClick={() => {
          setUnfolded(true);
        }}
      >
        Ajouter un enfant
      </Button>
    );
  }
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
