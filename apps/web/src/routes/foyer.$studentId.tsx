import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@repo/ui';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from '../lib/zod';
import { Field, SelectField } from '../components/field';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { QrCode } from '../components/qr-code';
import { WeekSummary } from '../components/week-summary';
import { api, isProblem, parseResponse } from '../lib/api';
import { authClient, authMessage } from '../lib/auth';
import { deviceName, formatDay, formatHour } from '../lib/device';
import { formatCode, pairingLink } from '../lib/pairing';
import { summaryQuery } from '../lib/summary';
import { LEVEL_LABELS, devicesQuery, householdMessage, memoryStatus, studentSchema, studentsQuery, type Student } from '../lib/household';

const student = api.household.students[':id'];

/**
 * One child of the household: their week, the way in to their space, the pairing of their
 * devices, their name and class, their account. Until a device holds their space, the next step
 * comes first.
 */
export const Route = createFileRoute('/foyer/$studentId')({
  loader: async ({ context, params }) => {
    // Started, not awaited: the week failing leaves the child's page, which says so.
    void context.queryClient.query(summaryQuery(params.studentId)).catch(() => undefined);
    const students = await context.queryClient.query(studentsQuery);
    if (!students.some(({ id }) => id === params.studentId)) throw redirect({ to: '/foyer' });
    await context.queryClient.query(devicesQuery(params.studentId));
  },
  component: StudentPage,
});

function StudentPage() {
  const { studentId } = Route.useParams();
  const { data: students } = useSuspenseQuery(studentsQuery);
  const { data: devices } = useSuspenseQuery(devicesQuery(studentId));
  const week = useQuery(summaryQuery(studentId));
  const child = students.find(({ id }) => id === studentId);
  if (!child) return null;

  return (
    <Page title={child.name}>
      <Link to="/foyer" className="min-h-11 py-3 text-sm text-primary underline">
        Retour au foyer
      </Link>
      {devices.length === 0 && (
        <Notice tone="info">
          Prochaine étape : {child.accompanied ? `faire les devoirs avec ${child.name} sur cet appareil.` : 'relier son appareil, avec un code.'}
        </Notice>
      )}
      <OpenHere child={child} />
      <WeekSummary week={week.data} failed={week.isError} name={child.name} reader="guardian" />
      <Devices child={child} />
      <Memory child={child} />
      <EditStudent child={child} />
      <DeleteStudent child={child} />
    </Page>
  );
}

/**
 * The family's phone, handed to the child: their session if the device holds it, otherwise one
 * paired here by the app, no code to copy. The server then closes the guardian's session on it
 * (platform/auth/pairing.ts): coming back takes the guardian's passkey or a code.
 */
function OpenHere({ child }: { child: Student }) {
  const navigate = useNavigate();
  const open = useMutation({
    mutationFn: async () => {
      const { data: held } = await authClient.multiSession.listDeviceSessions();
      const own = held?.find(({ user }) => user.id === child.id);
      const { error } = own
        ? await authClient.multiSession.setActive({ sessionToken: own.session.token })
        : await authClient.devicePairing.redeem({ code: (await parseResponse(student['pairing-code'].$post({ param: { id: child.id } }))).code });
      if (error) throw new Error(authMessage(error));
      // Loaded afresh: nothing of the guardian's stays in memory.
      await navigate({ to: '/', reloadDocument: true });
    },
  });

  return (
    <section className="flex flex-col gap-3">
      <Button
        disabled={open.isPending}
        onClick={() => {
          open.mutate();
        }}
      >
        {child.accompanied ? `Faire les devoirs avec ${child.name}` : `Ouvrir l’espace de ${child.name} sur cet appareil`}
      </Button>
      {child.accompanied && (
        <p className="text-sm text-muted-foreground">
          À chaque séance, {child.name} choisit : avec vous à côté, ou sans vous ce soir. À côté, Tom vous propose quoi dire, jamais la réponse.
        </p>
      )}
      <p className="text-sm text-muted-foreground">Pour revenir au vôtre, il vous faudra votre clé d’accès ou un code.</p>
      {open.error && <Notice tone="error">{open.error.message}</Notice>}
    </section>
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
      {child.accompanied ? (
        <p className="text-muted-foreground">
          En 6e et 5e, {child.name} travaille sur l’appareil de la famille ; relier son propre appareil devient possible en 4e.
        </p>
      ) : redeemed ? (
        <Notice tone="info">L’appareil de {child.name} est relié.</Notice>
      ) : pairing.data && pending(devices) ? (
        <>
          <p>Avec l’appareil photo de l’appareil de {child.name}, visez ce code :</p>
          <QrCode text={pairingLink(window.location.origin, pairing.data.code)} label={`QR code pour relier l’appareil de ${child.name}`} />
          <Notice tone="info">
            Ou, sur son appareil, ouvrez {window.location.origin}/jumeler et saisissez le code{' '}
            <strong className="font-mono text-lg tracking-widest">{formatCode(pairing.data.code)}</strong> avant {formatHour(pairing.data.expiresAt)}.
            Il ne sert qu’une fois.
          </Notice>
        </>
      ) : (
        <p className="text-muted-foreground">Un code à usage unique relie l’appareil de {child.name} à son compte, sans mot de passe.</p>
      )}
      {pairing.error && <Notice tone="error">{householdMessage(pairing.error)}</Notice>}
      {!child.accompanied && (
        <Button disabled={pairing.isPending} onClick={askCode}>
          {pending(devices) ? 'Nouveau code' : 'Relier un appareil'}
        </Button>
      )}
    </section>
  );
}

function Memory({ child }: { child: Student }) {
  const queryClient = useQueryClient();
  const [withdrawing, setWithdrawing] = useState(false);
  const propose = useMutation({
    mutationFn: (memoryProposed: boolean) => parseResponse(student.$patch({ param: { id: child.id }, json: { memoryProposed } })),
    onSuccess: () => {
      setWithdrawing(false);
      return queryClient.invalidateQueries({ queryKey: studentsQuery.queryKey });
    },
    // Refused, the child may have turned 15 meanwhile: the page reads it again.
    onError: () => queryClient.invalidateQueries({ queryKey: studentsQuery.queryKey }),
  });

  return (
    <section aria-labelledby="memory" className="flex flex-col gap-3">
      <h2 id="memory" className="text-xl font-bold text-foreground">
        Ce que Tom retient
      </h2>
      <p className="text-muted-foreground">{memoryStatus(child)}</p>
      {propose.error && (
        <Notice tone="error">
          {isProblem(propose.error, 'FORBIDDEN') ? `À partir de 15 ans, c’est ${child.name} qui décide.` : householdMessage(propose.error)}
        </Notice>
      )}
      {!child.memory.decidesAlone &&
        (withdrawing ? (
          <>
            <Notice tone="error">Tom oubliera ce qu’il retient de {child.name}, et lui reposera la question si vous la proposez de nouveau.</Notice>
            <Button
              disabled={propose.isPending}
              onClick={() => {
                propose.mutate(false);
              }}
            >
              Retirer et effacer
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setWithdrawing(false);
              }}
            >
              Annuler
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            disabled={propose.isPending}
            onClick={() => {
              if (child.memory.proposed) setWithdrawing(true);
              else propose.mutate(true);
            }}
          >
            {child.memory.proposed ? 'Retirer la mémoire' : `Proposer la mémoire à ${child.name}`}
          </Button>
        ))}
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
