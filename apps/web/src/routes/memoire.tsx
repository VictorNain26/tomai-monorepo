import { Button } from '@repo/ui';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { MemoryAnswer } from '../components/memory-answer';
import { Notice } from '../components/notice';
import { Page } from '../components/page';
import { api, parseResponse } from '../lib/api';
import { meQuery } from '../lib/me';
import { memoryMessage, memoryQuery, notionSummary } from '../lib/memory';

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
  const [erasing, setErasing] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: memoryQuery.queryKey });
  const understood = useMutation({
    mutationFn: (notionId: string) => parseResponse(api.memory.notions[':notionId'].$delete({ param: { notionId } })),
    onSuccess: refresh,
  });
  const erase = useMutation({ mutationFn: () => parseResponse(api.memory.$delete()), onSuccess: refresh });
  const stop = useMutation({ mutationFn: () => parseResponse(api.memory.answer.$post({ json: { answer: 'declined' } })), onSuccess: refresh });
  const failure = understood.error ?? erase.error ?? stop.error;

  return (
    <Page title="Ce que Tom retient">
      <Link to="/" className="min-h-11 py-3 text-sm text-primary underline">
        Retour à tes séances
      </Link>
      {failure && <Notice tone="error">{memoryMessage(failure)}</Notice>}
      {memory.state === 'active' ? (
        <>
          <p className="text-muted-foreground">
            Tom ne garde que les notions de tes exercices depuis la rentrée, jamais ce que tu écris. Ton parent n’en voit que le résumé de la semaine.
          </p>
          {memory.notions.length === 0 ? (
            <p className="text-muted-foreground">Rien pour l’instant : Tom retiendra les notions de tes prochains exercices.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {memory.notions.map((notion) => (
                <li key={notion.notionId} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-card-foreground">
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
          {erasing ? (
            <>
              <Notice tone="error">Tom oubliera tout ce qu’il retient de toi. Tes séances restent.</Notice>
              <Button
                disabled={erase.isPending}
                onClick={() => {
                  erase.mutate(undefined, {
                    onSuccess: () => {
                      setErasing(false);
                    },
                  });
                }}
              >
                Tout effacer
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setErasing(false);
                }}
              >
                Annuler
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                setErasing(true);
              }}
            >
              Effacer ce que Tom retient
            </Button>
          )}
          <Button
            variant="outline"
            disabled={stop.isPending}
            onClick={() => {
              stop.mutate();
            }}
          >
            Arrêter la mémoire
          </Button>
        </>
      ) : memory.mayAnswer ? (
        <MemoryAnswer />
      ) : (
        <p className="text-muted-foreground">
          Tom ne retient rien d’une séance à l’autre. Ton parent peut te proposer qu’il retienne ce qui a résisté.
        </p>
      )}
    </Page>
  );
}
