/** What Tom keeps of the student (`/api/memory`), in the words the student reads. */

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { api, isProblem, parseResponse } from './api';

type Memory = InferResponseType<typeof api.memory.$get, 200>;
type Notion = Memory['notions'][number];
/** The student's yes or no to the memory. */
export type MemoryChoice = InferRequestType<typeof api.memory.answer.$post>['json']['answer'];

export const memoryQuery = queryOptions({
  queryKey: ['memory'],
  queryFn: () => parseResponse(api.memory.$get()),
});

/** « La dernière fois : pas encore résolue, avec un indice. À surveiller : mal lire la consigne. », as the memory and the week say it. */
export function lastTime({ lastSolved, lastHelp, watch }: Pick<Notion, 'lastSolved' | 'lastHelp' | 'watch'>): string {
  return [
    `La dernière fois : ${lastSolved ? `résolue ${lastHelp}` : `pas encore résolue, ${lastHelp}`}.`,
    ...(watch ? [`À surveiller : ${watch}.`] : []),
  ].join(' ');
}

/** « Travaillée 2 fois. » and the last time. */
export const notionSummary = (notion: Notion): string => `Travaillée ${String(notion.worked)} fois. ${lastTime(notion)}`;

/** A failed memory request, in words a student reads. */
export function memoryMessage(error: unknown): string {
  if (isProblem(error, 'FORBIDDEN')) return 'Ton parent ne te la propose pas, ou plus : demande-lui.';
  if (isProblem(error, 'RATE_LIMITED')) return 'Trop d’essais. Attends une minute.';
  return 'Ça n’a pas marché. Réessaie dans un instant.';
}

/** The student's yes or no, which the server answers with the memory as it now stands. */
export function useMemoryAnswer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answer: MemoryChoice) => parseResponse(api.memory.answer.$post({ json: { answer } })),
    onSuccess: (memory) => {
      queryClient.setQueryData(memoryQuery.queryKey, memory);
    },
    // Refused, the proposal may have been withdrawn meanwhile: the screen reads it again.
    onError: () => queryClient.invalidateQueries({ queryKey: memoryQuery.queryKey }),
  });
}
