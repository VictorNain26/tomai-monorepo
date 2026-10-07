/** What Tom keeps of the student (`/api/memory`), in the words the student reads. */

import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { api, isProblem, parseResponse } from './api';

type Memory = InferResponseType<typeof api.memory.$get, 200>;
type Notion = Memory['notions'][number];

export const memoryQuery = queryOptions({
  queryKey: ['memory'],
  queryFn: () => parseResponse(api.memory.$get()),
});

/** « Travaillée 2 fois. La dernière fois : pas résolue, aide jusqu'à « Indice ciblé ». À surveiller : mal lire la consigne. » */
export function notionSummary({ worked, lastSolved, lastHelp, watch }: Notion): string {
  return [
    `Travaillée ${String(worked)} fois.`,
    `La dernière fois : ${lastSolved ? 'résolue' : 'pas résolue'}, aide jusqu’à « ${lastHelp} ».`,
    ...(watch ? [`À surveiller : ${watch}.`] : []),
  ].join(' ');
}

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
    mutationFn: (answer: 'accepted' | 'declined') => parseResponse(api.memory.answer.$post({ json: { answer } })),
    onSuccess: (memory) => {
      queryClient.setQueryData(memoryQuery.queryKey, memory);
    },
    // Refused, the proposal may have been withdrawn meanwhile: the screen reads it again.
    onError: () => queryClient.invalidateQueries({ queryKey: memoryQuery.queryKey }),
  });
}
