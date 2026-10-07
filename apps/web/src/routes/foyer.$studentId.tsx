import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@repo/ui';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from '../lib/zod';
import { Field, SelectField } from '../components/field';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { api, parseResponse } from '../lib/api';
import { deviceName, formatDay, formatHour } from '../lib/device';
import { formatCode } from '../lib/pairing';
import { LEVEL_LABELS, devicesQuery, householdMessage, studentSchema, studentsQuery, type Student } from '../lib/household';

const student = api.household.students[':id'];

/** One child of the household: the pairing of their devices, their name and class, their account. */
export const Route = createFileRoute('/foyer/$studentId')({
  loader: async ({ context, params }) => {
    const students = await context.queryClient.query(studentsQuery);
    if (!students.some(({ id }) => id === params.studentId)) throw redirect({ to: '/foyer' });
    await context.queryClient.query(devicesQuery(params.studentId));
  },
  component: StudentPage,
});

function StudentPage() {
  const { studentId } = Route.useParams();
  const { data: students } = useSuspenseQuery(studentsQuery);
  const child = students.find(({ id }) => id === studentId);
  if (!child) return null;

  return (
    <Page title={child.name}>
      <Link to="/foyer" className="min-h-11 py-3 text-sm text-primary underline">
        Retour au foyer
      </Link>
      <Devices child={child} />
      <EditStudent child={child} />
      <DeleteStudent child={child} />
    </Page>
  );
}

function Devices({ child }: { child: Student }) {
  const queryClient = useQueryClient();
  // The devices paired when the code was asked for: one more, and the code is spent.
  const [before, setBefore] = useState<ReadonlySet<string> | null>(null);
  const pairing = useMutation({ mutationFn: () => parseResponse(student['pairing-code'].$post({ param: { id: child.id } })) });
  const spent = (list: readonly { id: string }[]) => before !== null && list.some(({ id }) => !before.has(id));
  const pending = (list: readonly { id: string }[]) => pairing.data !== undefined && !spent(list) && Date.now() < Date.parse(pairing.data.expiresAt);
  // While a code waits on the child's device, the list shows it the moment it is redeemed.
  const { data: devices } = useSuspenseQuery({
    ...devicesQuery(child.id),
    refetchInterval: (query) => (pending(query.state.data ?? []) ? 5000 : false),
  });
  const redeemed = spent(devices);
  const askCode = () => {
    setBefore(new Set(devices.map(({ id }) => id)));
    pairing.mutate();
  };
  const revoke = useMutation({
    mutationFn: (deviceId: string) => parseResponse(student.devices[':deviceId'].$delete({ param: { id: child.id, deviceId } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: devicesQuery(child.id).queryKey }),
  });

  return (
    <section aria-labelledby="devices" className="flex flex-col gap-3">
      <h2 id="devices" className="text-xl font-bold text-foreground">
        Ses appareils
      </h2>
      {devices.length === 0 ? (
        <p className="text-muted-foreground">Aucun appareil relié.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {devices.map((device) => (
            <li key={device.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
              <span className="flex flex-col">
                <span className="font-bold">{deviceName(device.userAgent)}</span>
                <span className="text-sm text-muted-foreground">Relié le {formatDay(device.pairedAt)}</span>
              </span>
              <Button
                variant="outline"
                disabled={revoke.isPending}
                onClick={() => {
                  revoke.mutate(device.id);
                }}
              >
                Déconnecter
              </Button>
            </li>
          ))}
        </ul>
      )}
      {revoke.error && <Notice tone="error">{householdMessage(revoke.error)}</Notice>}
      {redeemed ? (
        <Notice tone="info">L’appareil de {child.name} est relié.</Notice>
      ) : pairing.data && pending(devices) ? (
        <Notice tone="info">
          Sur l’appareil de {child.name}, ouvrez {window.location.origin}/jumeler et saisissez le code{' '}
          <strong className="font-mono text-lg tracking-widest">{formatCode(pairing.data.code)}</strong> avant {formatHour(pairing.data.expiresAt)}.
          Il ne sert qu’une fois.
        </Notice>
      ) : (
        <p className="text-muted-foreground">Un code à usage unique relie l’appareil de {child.name} à son compte, sans mot de passe.</p>
      )}
      {pairing.error && <Notice tone="error">{householdMessage(pairing.error)}</Notice>}
      <Button disabled={pairing.isPending} onClick={askCode}>
        {pending(devices) ? 'Nouveau code' : 'Relier un appareil'}
      </Button>
    </section>
  );
}

function EditStudent({ child }: { child: Student }) {
  const queryClient = useQueryClient();
  const form = useForm({ resolver: zodResolver(studentSchema), defaultValues: { name: child.name, level: child.level } });
  const update = useMutation({
    mutationFn: (json: z.output<typeof studentSchema>) => parseResponse(student.$patch({ param: { id: child.id }, json })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentsQuery.queryKey }),
  });
  const submit = form.handleSubmit((values) => {
    update.mutate(values);
  });

  return (
    <section aria-labelledby="edit" className="flex flex-col gap-3">
      <h2 id="edit" className="text-xl font-bold text-foreground">
        Son prénom et sa classe
      </h2>
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        // A change after a save is not saved yet: its confirmation goes.
        onChange={() => {
          update.reset();
        }}
        className="flex flex-col gap-4"
      >
        <Field label="Son prénom" autoComplete="off" {...form.register('name')} error={form.formState.errors.name?.message} />
        <SelectField label="Sa classe" options={LEVEL_LABELS} {...form.register('level')} error={form.formState.errors.level?.message} />
        {update.error && <Notice tone="error">{householdMessage(update.error)}</Notice>}
        {update.isSuccess && <Notice tone="info">Enregistré.</Notice>}
        <Button type="submit" variant="outline" disabled={update.isPending}>
          Enregistrer
        </Button>
      </form>
    </section>
  );
}

function DeleteStudent({ child }: { child: Student }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => parseResponse(student.$delete({ param: { id: child.id } })),
    onSuccess: async () => {
      await navigate({ to: '/foyer' });
      await queryClient.invalidateQueries({ queryKey: studentsQuery.queryKey });
    },
  });

  return (
    <section aria-labelledby="delete" className="flex flex-col gap-3">
      <h2 id="delete" className="text-xl font-bold text-foreground">
        Supprimer son compte
      </h2>
      {confirming ? (
        <>
          <Notice tone="error">Ses séances seront effacées et ses appareils déconnectés. C’est définitif.</Notice>
          {remove.error && <Notice tone="error">{householdMessage(remove.error)}</Notice>}
          <Button
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate();
            }}
          >
            Supprimer définitivement
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setConfirming(false);
            }}
          >
            Annuler
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          onClick={() => {
            setConfirming(true);
          }}
        >
          Supprimer le compte de {child.name}
        </Button>
      )}
    </section>
  );
}
