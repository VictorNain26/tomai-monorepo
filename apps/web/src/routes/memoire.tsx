import { Button } from '@repo/ui';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { MemoryAnswer } from '../components/memory-answer';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { api, parseResponse } from '../lib/api';
import { meQuery } from '../lib/me';
import { memoryMessage, memoryQuery, notionSummary, useMemoryAnswer } from '../lib/memory';

/** What Tom keeps of the student, notion by notion: theirs to see, correct and erase. */
export const Route = createFileRoute('/memoire')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.query(meQuery);
    if (me?.role !== 'student') throw redirect({ to: '/' });
  },
  loader: ({ context }) => context.queryClient.query(memoryQuery),
  component: Memory,
});

function Memory() {
  const queryClient = useQueryClient();
  const { data: memory } = useSuspenseQuery(memoryQuery);
  const [confirming, setConfirming] = useState<'erase' | 'stop' | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: memoryQuery.queryKey });
  const understood = useMutation({
    mutationFn: (notionId: string) => parseResponse(api.memory.notions[':notionId'].$delete({ param: { notionId } })),
    onSuccess: refresh,
  });
  const erase = useMutation({ mutationFn: () => parseResponse(api.memory.$delete()), onSuccess: refresh });
  const answer = useMemoryAnswer();
  const failure = understood.error ?? erase.error ?? answer.error;

  return (
    <Page title="Ce que Tom retient">
      <Link to="/" className="min-h-11 py-3 text-sm text-primary underline">
        Retour à tes séances
      </Link>
      {failure && <Notice tone="error">{memoryMessage(failure)}</Notice>}
      {memory.state === 'active' ? (
        <>
          <p className="text-muted-foreground">
            Tom ne garde que les notions de tes exercices depuis la rentrée, jamais ce que tu écris. Ton parent voit seulement si la mémoire est
            active.
          </p>
          {memory.notions.length === 0 ? (
            <p className="text-muted-foreground">Rien pour l’instant : Tom retiendra les notions de tes prochains exercices.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {memory.notions.map((notion) => (
                <li key={notion.notionId} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-card-foreground">
                  <span className="text-sm text-muted-foreground">Au programme</span>
                  <span className="font-bold">{notion.label}</span>
                  <span className="text-sm text-muted-foreground">{notionSummary(notion)}</span>
                  <Button
                    variant="outline"
                    disabled={understood.isPending}
                    onClick={() => {
                      understood.mutate(notion.notionId);
                    }}
                  >
                    J’ai compris
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {confirming ? (
            <>
              <Notice tone="error">
                {confirming === 'erase'
                  ? 'Tom oubliera tout ce qu’il retient de toi. Tes séances restent.'
                  : 'Tom oubliera tout ce qu’il retient de toi et ne retiendra plus rien. Tes séances restent.'}
              </Notice>
              <Button
                disabled={erase.isPending || answer.isPending}
                onClick={() => {
                  const done = {
                    onSuccess: () => {
                      setConfirming(null);
                    },
                  };
                  if (confirming === 'erase') erase.mutate(undefined, done);
                  else answer.mutate('declined', done);
                }}
              >
                {confirming === 'erase' ? 'Tout effacer' : 'Arrêter et tout effacer'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirming(null);
                }}
              >
                Annuler
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirming('erase');
                }}
              >
                Effacer ce que Tom retient
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirming('stop');
                }}
              >
                Arrêter la mémoire
              </Button>
            </>
          )}
        </>
      ) : memory.mayAnswer ? (
        <MemoryAnswer answer={answer} />
      ) : (
        <p className="text-muted-foreground">
          Tom ne retient rien d’une séance à l’autre. Ton parent peut te proposer qu’il retienne ce qui a résisté.
        </p>
      )}
    </Page>
  );
}
